from __future__ import annotations

from fastapi import HTTPException, status

from app.config import Settings
from app.schemas import SummaryPayload, SummaryType
from app.services.openrouter import create_chat_completion, extract_message_text


SUMMARY_INSTRUCTIONS: dict[SummaryType, str] = {
    SummaryType.short: (
        "Verilen transcripti Turkce olarak en fazla 3 cumlede ozetle. "
        "Kisa, net ve sonuc odakli ol."
    ),
    SummaryType.long: (
        "Verilen transcripti Turkce olarak detayli ozetle. "
        "Kapsam, akisin onemli bolumleri ve cikarimlar dahil olsun."
    ),
    SummaryType.bullet_points: (
        "Verilen transcript icin Turkce madde madde bir ozet uret. "
        "Her madde kisa ama anlamli olsun."
    ),
    SummaryType.main_idea: (
        "Verilen transcriptin tek bir ana fikrini Turkce olarak acikla. "
        "1 kisa paragraf yeterli."
    ),
}


def _generate_summary(
    settings: Settings,
    model: str,
    summary_type: SummaryType,
    transcript: str,
) -> str:
    if not transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bos transcript icin ozet olusturulamaz.",
        )

    response = create_chat_completion(
        settings=settings,
        model=model,
        messages=[
            {
                "role": "system",
                "content": SUMMARY_INSTRUCTIONS[summary_type],
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


def build_summaries(
    settings: Settings,
    model: str,
    transcript: str,
    summary_type: SummaryType,
) -> SummaryPayload:
    if summary_type == SummaryType.all:
        return SummaryPayload(
            short=_generate_summary(settings, model, SummaryType.short, transcript),
            long=_generate_summary(settings, model, SummaryType.long, transcript),
            bullet_points=_generate_summary(
                settings, model, SummaryType.bullet_points, transcript
            ),
            main_idea=_generate_summary(
                settings, model, SummaryType.main_idea, transcript
            ),
        )

    value = _generate_summary(settings, model, summary_type, transcript)
    return SummaryPayload(**{summary_type.value: value})
