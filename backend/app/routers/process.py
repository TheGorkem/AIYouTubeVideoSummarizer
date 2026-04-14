from __future__ import annotations

import asyncio
from functools import partial

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.config import Settings, get_settings
from app.schemas import ProcessResponse, SummaryType
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
    file: UploadFile | None = File(default=None),
    settings: Settings = Depends(get_settings),
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

    summaries = await loop.run_in_executor(
        None,
        partial(
            build_summaries,
            settings=settings,
            model=settings.openrouter_summary_model,
            transcript=transcript_data["transcript"],
            summary_type=summary_type,
        ),
    )

    return ProcessResponse(
        source_kind=transcript_data["source_kind"],
        transcript_source=transcript_data["transcript_source"],
        language_hint=transcript_data["language_hint"],
        transcript=transcript_data["transcript"],
        summaries=summaries,
    )
