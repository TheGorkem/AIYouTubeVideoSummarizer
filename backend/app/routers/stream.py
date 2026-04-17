from __future__ import annotations

import asyncio
import json
from functools import partial
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.database import db_session
from app.schemas import SummaryLanguage, SummaryPayload, SummaryType
from app.services.auth import get_optional_user_id
from app.services.summarizer import _generate_summary
from app.services.transcript import transcript_from_upload, transcript_from_youtube

router = APIRouter(prefix="/api/v1", tags=["stream"])


def _sse_event(step: str, message: str, payload: dict | None = None) -> str:
    data = {"step": step, "message": message}
    if payload is not None:
        data["payload"] = payload
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _stream_process(
    youtube_url: str | None,
    file: UploadFile | None,
    summary_type: SummaryType,
    summary_language: SummaryLanguage,
    anonymous_session_id: str | None,
    settings: Settings,
    user_id: int | None,
) -> AsyncGenerator[str, None]:
    loop = asyncio.get_running_loop()
    lang = summary_language.value

    # Step 1: Transcript
    yield _sse_event("transcript_start", "Transcript aliniyor...")

    try:
        if youtube_url:
            transcript_data = await loop.run_in_executor(
                None, partial(transcript_from_youtube, youtube_url)
            )
        else:
            transcript_data = await transcript_from_upload(
                file=file,
                settings=settings,
                model=settings.openrouter_transcription_model,
            )
    except HTTPException as exc:
        yield _sse_event("error", exc.detail)
        return

    yield _sse_event("transcript_done", "Transcript hazir.", {
        "transcript": transcript_data["transcript"],
        "timestamped_transcript": transcript_data.get("timestamped_transcript"),
        "source_kind": transcript_data["source_kind"],
        "transcript_source": transcript_data["transcript_source"],
        "language_hint": transcript_data.get("language_hint"),
    })

    # Step 2: Summaries
    transcript_text = transcript_data["transcript"]
    model = settings.openrouter_summary_model

    summary_types_to_generate: list[tuple[SummaryType, str, str]] = []
    if summary_type == SummaryType.all:
        summary_types_to_generate = [
            (SummaryType.short, "summary_short", "Kisa ozet hazirlaniyor..."),
            (SummaryType.long, "summary_long", "Uzun ozet hazirlaniyor..."),
            (SummaryType.bullet_points, "summary_bullets", "Bullet point ozet hazirlaniyor..."),
            (SummaryType.main_idea, "summary_main", "Ana fikir hazirlaniyor..."),
        ]
    else:
        summary_types_to_generate = [
            (summary_type, f"summary_{summary_type.value}", f"{summary_type.value} hazirlaniyor..."),
        ]

    summaries_dict: dict[str, str | None] = {
        "short": None, "long": None, "bullet_points": None, "main_idea": None,
    }

    for st, step_name, step_msg in summary_types_to_generate:
        yield _sse_event(step_name + "_start", step_msg)
        try:
            result = await loop.run_in_executor(
                None,
                partial(_generate_summary, settings, model, st, transcript_text, lang),
            )
            summaries_dict[st.value] = result
            yield _sse_event(step_name + "_done", f"{st.value} tamamlandi.", {st.value: result})
        except HTTPException as exc:
            yield _sse_event("error", f"{st.value} olusturulamadi: {exc.detail}")

    summaries = SummaryPayload(**summaries_dict)

    # Step 3: Save to history
    history_id: int | None = None
    if user_id is not None or anonymous_session_id:
        async with db_session() as conn:
            cursor = await conn.execute(
                """INSERT INTO history
                   (user_id, anonymous_session_id, source_kind, youtube_url, filename,
                    transcript, timestamped_transcript, summaries_json, summary_language)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id,
                    anonymous_session_id if user_id is None else None,
                    transcript_data["source_kind"],
                    youtube_url,
                    file.filename if file else None,
                    transcript_text,
                    transcript_data.get("timestamped_transcript"),
                    json.dumps(summaries.model_dump(), ensure_ascii=False),
                    lang,
                ),
            )
            await conn.commit()
            history_id = cursor.lastrowid

    yield _sse_event("done", "Islem tamamlandi.", {
        "id": history_id,
        "source_kind": transcript_data["source_kind"],
        "transcript_source": transcript_data["transcript_source"],
        "language_hint": transcript_data.get("language_hint"),
        "transcript": transcript_text,
        "timestamped_transcript": transcript_data.get("timestamped_transcript"),
        "summaries": summaries.model_dump(),
        "summary_language": lang,
    })


@router.post("/process/stream")
async def process_stream(
    youtube_url: str | None = Form(default=None),
    summary_type: SummaryType = Form(default=SummaryType.all),
    summary_language: SummaryLanguage = Form(default=SummaryLanguage.tr),
    file: UploadFile | None = File(default=None),
    anonymous_session_id: str | None = Header(default=None, alias="X-Anonymous-Session"),
    settings: Settings = Depends(get_settings),
    user_id: int | None = Depends(get_optional_user_id),
):
    youtube_url = youtube_url.strip() if youtube_url else None

    if not youtube_url and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bir YouTube linki veya ses/video dosyasi gondermelisiniz.",
        )
    if youtube_url and file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ayni anda sadece tek kaynak gonderebilirsiniz.",
        )

    return StreamingResponse(
        _stream_process(
            youtube_url=youtube_url,
            file=file,
            summary_type=summary_type,
            summary_language=summary_language,
            anonymous_session_id=anonymous_session_id,
            settings=settings,
            user_id=user_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
