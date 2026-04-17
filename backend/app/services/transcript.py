from __future__ import annotations

import base64
import shutil
import subprocess
from os.path import splitext
from pathlib import Path
from tempfile import TemporaryDirectory
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

SUPPORTED_AUDIO_FORMATS = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}

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

    snippets = list(fetched)

    transcript = " ".join(
        snippet.text.replace("\n", " ").strip() for snippet in snippets if snippet.text
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

    # Build timestamped transcript [MM:SS] text
    ts_lines: list[str] = []
    for snippet in snippets:
        if not snippet.text:
            continue
        total_seconds = int(snippet.start)
        minutes, seconds = divmod(total_seconds, 60)
        ts_lines.append(f"[{minutes:02d}:{seconds:02d}] {snippet.text.replace(chr(10), ' ').strip()}")
    timestamped_transcript = "\n".join(ts_lines) if ts_lines else None

    return {
        "source_kind": "youtube",
        "transcript_source": "youtube-transcript-api",
        "language_hint": "tr/en",
        "transcript": transcript,
        "timestamped_transcript": timestamped_transcript,
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


def _maybe_prepare_media_for_transcription(
    *,
    file: UploadFile,
    data: bytes,
    settings: Settings,
) -> tuple[bytes, str, str]:
    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    target_size_bytes = settings.compressed_upload_target_mb * 1024 * 1024
    is_video = _is_video_upload(file)
    audio_format = _detect_audio_format(file)

    if (
        not is_video
        and len(data) <= max_size_bytes
        and audio_format in SUPPORTED_AUDIO_FORMATS
    ):
        return data, audio_format, file.filename or f"upload.{audio_format}"

    if shutil.which("ffmpeg") is None:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Dosya cok buyuk. En fazla {settings.max_upload_size_mb} MB "
                "dosya yukleyebilirsiniz. Daha kucuk bir ses dosyasi kullanin."
            ),
        )

    compressed = _transcode_media_with_ffmpeg(
        data=data,
        source_filename=file.filename or ("recording.mp4" if is_video else "recording.wav"),
        target_size_bytes=target_size_bytes,
    )

    if len(compressed) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Dosya islendikten sonra bile cok buyuk kaldi. En fazla "
                f"{settings.max_upload_size_mb} MB boyutunda, daha kisa veya daha dusuk "
                "kaliteli bir ses dosyasi yukleyin."
            ),
        )

    return compressed, "mp3", "normalized.mp3"


def _transcode_media_with_ffmpeg(
    *,
    data: bytes,
    source_filename: str,
    target_size_bytes: int,
) -> bytes:
    suffix = splitext(source_filename)[1] or ".bin"
    with TemporaryDirectory(prefix="ai-video-summarizer-") as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / f"input{suffix}"
        output_path = temp_path / "normalized.mp3"
        input_path.write_bytes(data)

        bitrate_kbps = max(24, min(64, int((target_size_bytes * 8) / 1000 / 60)))
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            f"{bitrate_kbps}k",
            str(output_path),
        ]
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not output_path.exists():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Yuklenen medya dosyasi islenemedi. Desteklenen bir ses/video dosyasi "
                    "yuklediginden emin olun."
                ),
            )

        return output_path.read_bytes()


async def transcript_from_upload(
    file: UploadFile, settings: Settings, model: str
) -> dict[str, Any]:
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yuklenen dosya bos olamaz.",
        )

    processed_data, processed_format, processed_filename = _maybe_prepare_media_for_transcription(
        file=file,
        data=data,
        settings=settings,
    )
    response = _transcript_from_audio_upload(
        data=processed_data,
        audio_format=processed_format,
        filename=processed_filename,
        settings=settings,
        model=model,
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
        "timestamped_transcript": None,
    }


def _transcript_from_audio_upload(
    *,
    data: bytes,
    audio_format: str,
    filename: str,
    settings: Settings,
    model: str,
) -> dict[str, Any]:
    audio_b64 = base64.b64encode(data).decode("utf-8")

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
                            "filename": filename,
                        },
                        "inputAudio": {
                            "data": audio_b64,
                            "format": audio_format,
                            "filename": filename,
                        },
                    },
                ],
            }
        ],
    )
