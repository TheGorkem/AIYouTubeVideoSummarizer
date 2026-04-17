from __future__ import annotations

import asyncio
from functools import partial

from fastapi import HTTPException, status

from app.config import Settings
from app.schemas import SummaryPayload, SummaryType

from app.services.openrouter import create_chat_completion, extract_message_text

LANGUAGE_NAMES = {
    "tr": "Turkce",
    "en": "English",
}


def _get_summary_instructions(language: str) -> dict[SummaryType, str]:
    lang_name = LANGUAGE_NAMES.get(language, "Turkce")
    return {
        SummaryType.short: (
            f"Verilen transcripti {lang_name} olarak en fazla 3 cumlede ozetle. "
            "Kisa, net ve sonuc odakli ol."
        ),
        SummaryType.long: (
            f"Verilen transcripti {lang_name} olarak detayli ozetle. "
            "Kapsam, akisin onemli bolumleri ve cikarimlar dahil olsun."
        ),
        SummaryType.bullet_points: (
            f"Verilen transcript icin {lang_name} madde madde bir ozet uret. "
            "Her madde kisa ama anlamli olsun."
        ),
        SummaryType.main_idea: (
            f"Verilen transcriptin tek bir ana fikrini {lang_name} olarak acikla. "
            "1 kisa paragraf yeterli."
        ),
    }


def _generate_summary(
    settings: Settings,
    model: str,
    summary_type: SummaryType,
    transcript: str,
    language: str = "tr",
) -> str:
    if not transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bos transcript icin ozet olusturulamaz.",
        )

    instructions = _get_summary_instructions(language)

    response = create_chat_completion(
        settings=settings,
        model=model,
        messages=[
            {
                "role": "system",
                "content": instructions[summary_type],
            },
            {
                "role": "user",
                "content": (
                    "Asagidaki transcripti isleyip yalnizca istenen ozet formatinda "
                    "yanit ver.\n\n"
                    f"Transcript:\n{transcript}"
                ),
            },
        ],
    )

    output_text = extract_message_text(response)
    if not output_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI ozet olusturulamadi.",
        )
    return output_text


async def build_summaries(
    settings: Settings,
    model: str,
    transcript: str,
    summary_type: SummaryType,
    language: str = "tr",
) -> SummaryPayload:
    """Build summaries. When 'all' is selected, generates 4 summaries in parallel."""
    loop = asyncio.get_running_loop()

    def _gen(st: SummaryType) -> str:
        return _generate_summary(settings, model, st, transcript, language)

    if summary_type == SummaryType.all:
        short, long, bullet_points, main_idea = await asyncio.gather(
            loop.run_in_executor(None, partial(_gen, SummaryType.short)),
            loop.run_in_executor(None, partial(_gen, SummaryType.long)),
            loop.run_in_executor(None, partial(_gen, SummaryType.bullet_points)),
            loop.run_in_executor(None, partial(_gen, SummaryType.main_idea)),
        )
        return SummaryPayload(
            short=short,
            long=long,
            bullet_points=bullet_points,
            main_idea=main_idea,
        )

    value = await loop.run_in_executor(None, partial(_gen, summary_type))
    return SummaryPayload(**{summary_type.value: value})
