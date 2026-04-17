from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    openrouter_api_key: str = Field(..., alias="OPENROUTER_API_KEY")
    openrouter_summary_model: str = Field(
        "google/gemini-2.5-flash", alias="OPENROUTER_SUMMARY_MODEL"
    )
    openrouter_transcription_model: str = Field(
        "google/gemini-2.5-flash", alias="OPENROUTER_TRANSCRIPTION_MODEL"
    )
    openrouter_site_url: str = Field(
        "http://localhost:3000", alias="OPENROUTER_SITE_URL"
    )
    openrouter_app_name: str = Field(
        "AI Video Summarizer", alias="OPENROUTER_APP_NAME"
    )
    max_upload_size_mb: int = Field(12, alias="MAX_UPLOAD_SIZE_MB")
    compressed_upload_target_mb: int = Field(8, alias="COMPRESSED_UPLOAD_TARGET_MB")
    allowed_origins: str = Field("http://localhost:3000", alias="ALLOWED_ORIGINS")
    database_path: str = Field("data/app.db", alias="DATABASE_PATH")
    jwt_secret: str = Field("change-me-in-production", alias="JWT_SECRET")
    jwt_expire_minutes: int = Field(1440, alias="JWT_EXPIRE_MINUTES")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin]


@lru_cache
def get_settings() -> Settings:
    return Settings()
