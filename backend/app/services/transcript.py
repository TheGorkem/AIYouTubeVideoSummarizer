from __future__ import annotations

import base64
from io import BytesIO
from os.path import splitext
from typing import Any
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException, UploadFile, status
from youtube_transcript_api import (
    CouldNotRetrieveTranscript,
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeRequestFailed,
    YouTubeTranscriptApi,
)

from app.config import Settings
from app.services.openrouter import create_chat_completion, extract_message_text


TRANSCRIPT_RETRY_EXCEPTIONS = (
    RequestBlocked,
    CouldNotRetrieveTranscript,
    YouTubeRequestFailed,
)


def extract_youtube_video_id(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower().replace("www.", "")

    if host == "youtu.be":
        return parsed.path.strip("/")

    if host in {"youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [""])[0]
        if parsed.path.startswith("/shorts/") or parsed.path.startswith("/embed/"):
            parts = [part for part in parsed.path.split("/") if part]
            return parts[1] if len(parts) > 1 else ""

    return ""


def transcript_from_youtube(url: str) -> dict[str, Any]:
    video_id = extract_youtube_video_id(url)
    if not video_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gecersiz bir YouTube baglantisi girdiniz.",
        )

    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=["tr", "en"])
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Bu video icin hazir transcript bulunamadi. "
                "Video dosyasi yukleyerek OpenRouter ile devam edin."
            ),
        ) from exc
    except TRANSCRIPT_RETRY_EXCEPTIONS as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "YouTube transcript servisine su anda erisilemedi. "
                "Lutfen daha sonra tekrar deneyin veya dosya yukleyin."
            ),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "YouTube transcript alinurken beklenmeyen bir hata olustu. "
                "Video herkese acik degilse, transcript kapaliysa veya YouTube bos yanit "
                "dondurduyse bu hata gorulebilir. Dosya yukleyerek de deneyebilirsin."
            ),
        ) from exc

    transcript = " ".join(
        snippet.text.replace("\n", " ").strip() for snippet in fetched if snippet.text
    )
    transcript = transcript.strip()
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Bu video icin kullanilabilir transcript bulunamadi. "
                "Video dosyasi yukleyerek OpenRouter ile devam edin."
            ),
        )

    return {
        "source_kind": "youtube",
        "transcript_source": "youtube-transcript-api",
        "language_hint": "tr/en",
        "transcript": transcript,
    }


def _detect_audio_format(file: UploadFile) -> str:
    content_type = file.content_type or ""
    if "/" in content_type:
        subtype = content_type.split("/")[-1].lower()
        if subtype in {"mpeg", "mpga"}:
            return "mp3"
        if subtype == "x-m4a":
            return "m4a"
        if subtype in {"wav", "mp3", "ogg", "flac", "aac", "m4a"}:
            return subtype

    extension = splitext(file.filename or "")[1].lower().lstrip(".")
    if extension in {"mp3", "wav", "ogg", "flac", "aac", "m4a"}:
        return extension

    return "wav"


def _is_video_upload(file: UploadFile) -> bool:
    content_type = (file.content_type or "").lower()
    if content_type.startswith("video/"):
        return True

    extension = splitext(file.filename or "")[1].lower()
    return extension in {".mp4", ".mpeg", ".mov", ".webm"}


async def transcript_from_upload(
    file: UploadFile, settings: Settings, model: str
) -> dict[str, Any]:
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yuklenen dosya bos olamaz.",
        )

    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(data) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Dosya cok buyuk. En fazla {settings.max_upload_size_mb} MB "
                "dosya yukleyebilirsiniz. Daha kucuk bir ses dosyasi kullanin veya "
                "videoyu once sikistirin."
            ),
        )

    audio_file = BytesIO(data)
    audio_file.name = file.filename or "recording.mp4"
    response = (
        _transcript_from_video_upload(file=file, data=data, settings=settings, model=model)
        if _is_video_upload(file)
        else _transcript_from_audio_upload(file=file, data=data, settings=settings, model=model)
    )
    transcript = extract_message_text(response)
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Ses dosyasindan transcript olusturulamadi.",
        )

    return {
        "source_kind": "upload",
        "transcript_source": model,
        "language_hint": None,
        "transcript": transcript,
    }


def _transcript_from_audio_upload(
    *,
    file: UploadFile,
    data: bytes,
    settings: Settings,
    model: str,
) -> dict[str, Any]:
    audio_b64 = base64.b64encode(data).decode("utf-8")
    audio_format = _detect_audio_format(file)

    return create_chat_completion(
        settings=settings,
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Bu ses kaydini duz transcript olarak yaz. "
                            "Ek aciklama ekleme, yalnizca transcript don."
                        ),
                    },
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_b64,
                            "format": audio_format,
                        },
                        "inputAudio": {
                            "data": audio_b64,
                            "format": audio_format,
                        },
                    },
                ],
            }
        ],
    )


def _transcript_from_video_upload(
    *,
    file: UploadFile,
    data: bytes,
    settings: Settings,
    model: str,
) -> dict[str, Any]:
    content_type = (file.content_type or "video/mp4").lower()
    if content_type not in {"video/mp4", "video/mpeg", "video/mov", "video/webm"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Video dosya formati desteklenmiyor. Lutfen mp4, mpeg, mov veya webm yukleyin."
            ),
        )

    video_data_url = f"data:{content_type};base64,{base64.b64encode(data).decode('utf-8')}"

    return create_chat_completion(
        settings=settings,
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Bu videodaki konusmalari duz transcript olarak yaz. "
                            "Konusma yoksa kisaca bunu belirt. Ek aciklama ekleme."
                        ),
                    },
                    {
                        "type": "video_url",
                        "video_url": {"url": video_data_url},
                        "videoUrl": {"url": video_data_url},
                    },
                ],
            }
        ],
    )
