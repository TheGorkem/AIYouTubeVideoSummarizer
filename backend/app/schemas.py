from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class SummaryType(str, Enum):
    short = "short"
    long = "long"
    bullet_points = "bullet_points"
    main_idea = "main_idea"
    all = "all"


class SummaryLanguage(str, Enum):
    tr = "tr"
    en = "en"


class SummaryPayload(BaseModel):
    short: str | None = None
    long: str | None = None
    bullet_points: str | None = None
    main_idea: str | None = None


class ProcessResponse(BaseModel):
    id: int | None = Field(None, description="History record ID (null if anonymous)")
    source_kind: str = Field(..., description="youtube or upload")
    transcript_source: str = Field(
        ..., description="youtube-transcript-api or model name"
    )
    language_hint: str | None = None
    transcript: str
    timestamped_transcript: str | None = None
    summaries: SummaryPayload
    summary_language: str = "tr"


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    display_name: str = Field("", max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserInfo


class UserInfo(BaseModel):
    id: int
    email: str
    display_name: str


# ---------- History ----------

class HistoryItem(BaseModel):
    id: int
    source_kind: str
    youtube_url: str | None = None
    filename: str | None = None
    transcript: str
    timestamped_transcript: str | None = None
    summaries: SummaryPayload
    summary_language: str = "tr"
    share_token: str | None = None
    created_at: str


class HistoryListResponse(BaseModel):
    items: list[HistoryItem]
    total: int


class ResummarizeRequest(BaseModel):
    summary_type: SummaryType = SummaryType.all
    summary_language: SummaryLanguage = SummaryLanguage.tr


# ---------- SSE ----------

class StreamEvent(BaseModel):
    step: str
    message: str
    payload: dict | None = None
