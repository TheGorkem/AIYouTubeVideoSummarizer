from __future__ import annotations

import asyncio
import json
from functools import partial

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status

from app.config import Settings, get_settings
from app.database import db_session
from app.schemas import ProcessResponse, SummaryLanguage, SummaryType
from app.services.auth import get_optional_user_id
from app.services.summarizer import build_summaries
from app.services.transcript import transcript_from_upload, transcript_from_youtube

router = APIRouter(prefix="/api/v1", tags=["process"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/process", response_model=ProcessResponse)
async def process_content(
    youtube_url: str | None = Form(default=None),
    summary_type: SummaryType = Form(default=SummaryType.all),
    summary_language: SummaryLanguage = Form(default=SummaryLanguage.tr),
    file: UploadFile | None = File(default=None),
    anonymous_session_id: str | None = Header(default=None, alias="X-Anonymous-Session"),
    settings: Settings = Depends(get_settings),
    user_id: int | None = Depends(get_optional_user_id),
) -> ProcessResponse:
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

    loop = asyncio.get_running_loop()

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

    summaries = await build_summaries(
        settings=settings,
        model=settings.openrouter_summary_model,
        transcript=transcript_data["transcript"],
        summary_type=summary_type,
        language=summary_language.value,
    )

    # Save to history for authenticated or anonymous browser sessions
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
                    transcript_data["transcript"],
                    transcript_data.get("timestamped_transcript"),
                    json.dumps(summaries.model_dump(), ensure_ascii=False),
                    summary_language.value,
                ),
            )
            await conn.commit()
            history_id = cursor.lastrowid

    return ProcessResponse(
        id=history_id,
        source_kind=transcript_data["source_kind"],
        transcript_source=transcript_data["transcript_source"],
        language_hint=transcript_data["language_hint"],
        transcript=transcript_data["transcript"],
        timestamped_transcript=transcript_data.get("timestamped_transcript"),
        summaries=summaries,
        summary_language=summary_language.value,
    )
