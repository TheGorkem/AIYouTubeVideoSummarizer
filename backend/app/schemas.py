from enum import Enum

from pydantic import BaseModel, Field


class SummaryType(str, Enum):
    short = "short"
    long = "long"
    bullet_points = "bullet_points"
    main_idea = "main_idea"
    all = "all"


class SummaryPayload(BaseModel):
    short: str | None = None
    long: str | None = None
    bullet_points: str | None = None
    main_idea: str | None = None


class ProcessResponse(BaseModel):
    source_kind: str = Field(..., description="youtube or upload")
    transcript_source: str = Field(
        ..., description="youtube-transcript-api or whisper-1"
    )
    language_hint: str | None = None
    transcript: str
    summaries: SummaryPayload
