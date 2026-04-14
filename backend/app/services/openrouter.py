from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def build_headers(settings: Settings) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-OpenRouter-Title": settings.openrouter_app_name,
    }


def create_chat_completion(
    *,
    settings: Settings,
    model: str,
    messages: list[dict[str, Any]],
    max_tokens: int = 4096,
) -> dict[str, Any]:
    try:
        response = httpx.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=build_headers(settings),
            json={
                "model": model,
                "messages": messages,
                "stream": False,
                "max_tokens": max_tokens,
            },
            timeout=120.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = f"OpenRouter istegi basarisiz oldu (HTTP {exc.response.status_code})."
        try:
            payload = exc.response.json()
            detail = payload.get("error", {}).get("message", detail)
        except ValueError:
            raw_text = exc.response.text.strip()
            if raw_text:
                detail = f"{detail} {raw_text[:300]}"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter servisine baglanilamadi.",
        ) from exc

    return response.json()


def extract_message_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter bos bir yanit dondurdu.",
        )

    message = choices[0].get("message") or {}
    content = message.get("content")

    if isinstance(content, str):
        text = content.strip()
        if text:
            return text

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"].strip())
        text = "\n".join(part for part in text_parts if part).strip()
        if text:
            return text

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="OpenRouter yanitindan metin cikartilamadi.",
    )
