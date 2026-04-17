from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.database import db_session
from app.schemas import HistoryItem, SummaryPayload
from app.services.auth import get_current_user_id

router = APIRouter(prefix="/api/v1", tags=["share"])


def _row_to_public_item(row) -> HistoryItem:
    summaries_raw = json.loads(row["summaries_json"]) if row["summaries_json"] else {}
    return HistoryItem(
        id=row["id"],
        source_kind=row["source_kind"],
        youtube_url=row["youtube_url"],
        filename=row["filename"],
        transcript=row["transcript"],
        timestamped_transcript=row["timestamped_transcript"],
        summaries=SummaryPayload(**summaries_raw),
        summary_language=row["summary_language"] if "summary_language" in row.keys() else "tr",
        share_token=row["share_token"],
        created_at=row["created_at"],
    )


@router.post("/history/{history_id}/share")
async def create_share_link(
    history_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, str]:
    token = uuid.uuid4().hex
    async with db_session() as conn:
        cursor = await conn.execute(
            "UPDATE history SET share_token = ? WHERE id = ? AND user_id = ?",
            (token, history_id, user_id),
        )
        await conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gecmis kaydi bulunamadi.",
            )
    return {"share_token": token}


@router.delete("/history/{history_id}/share")
async def remove_share_link(
    history_id: int,
    user_id: int = Depends(get_current_user_id),
):
    async with db_session() as conn:
        cursor = await conn.execute(
            "UPDATE history SET share_token = NULL WHERE id = ? AND user_id = ?",
            (history_id, user_id),
        )
        await conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gecmis kaydi bulunamadi.",
            )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/shared/{token}", response_model=HistoryItem)
async def get_shared_item(token: str) -> HistoryItem:
    """Public endpoint — no auth required."""
    async with db_session() as conn:
        cursor = await conn.execute(
            "SELECT * FROM history WHERE share_token = ?", (token,)
        )
        row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paylasim bulunamadi veya kaldirilmis.",
        )
    return _row_to_public_item(row)
