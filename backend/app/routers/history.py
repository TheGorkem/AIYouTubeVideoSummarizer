from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.database import db_session
from app.config import Settings, get_settings
from app.schemas import (
    HistoryItem,
    HistoryListResponse,
    ProcessResponse,
    ResummarizeRequest,
    SummaryPayload,
)
from app.services.auth import get_current_user_id
from app.services.summarizer import build_summaries

router = APIRouter(prefix="/api/v1/history", tags=["history"])


def _row_to_item(row) -> HistoryItem:
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
        share_token=row["share_token"] if "share_token" in row.keys() else None,
        created_at=row["created_at"],
    )


def build_history_filters(
    *,
    user_id: int,
    search_query: str | None,
    source_kind: str | None,
) -> tuple[str, list[object]]:
    clauses = ["user_id = ?"]
    params: list[object] = [user_id]

    if source_kind in {"youtube", "upload"}:
        clauses.append("source_kind = ?")
        params.append(source_kind)

    normalized_query = search_query.strip() if search_query else ""
    if normalized_query:
        like_query = f"%{normalized_query}%"
        clauses.append(
            "("
            "youtube_url LIKE ? OR "
            "filename LIKE ? OR "
            "transcript LIKE ? OR "
            "summaries_json LIKE ?"
            ")"
        )
        params.extend([like_query, like_query, like_query, like_query])

    return " AND ".join(clauses), params


@router.get("", response_model=HistoryListResponse)
async def list_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(default=None, max_length=200),
    source_kind: str | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
) -> HistoryListResponse:
    where_clause, where_params = build_history_filters(
        user_id=user_id, search_query=q, source_kind=source_kind,
    )
    async with db_session() as conn:
        count_cursor = await conn.execute(
            f"SELECT COUNT(*) as cnt FROM history WHERE {where_clause}",
            where_params,
        )
        count_row = await count_cursor.fetchone()
        total = count_row["cnt"] if count_row else 0

        cursor = await conn.execute(
            f"""SELECT * FROM history
                WHERE {where_clause}
                ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            [*where_params, limit, offset],
        )
        rows = await cursor.fetchall()

    return HistoryListResponse(
        items=[_row_to_item(row) for row in rows],
        total=total,
    )


@router.get("/{history_id}", response_model=HistoryItem)
async def get_history_item(
    history_id: int,
    user_id: int = Depends(get_current_user_id),
) -> HistoryItem:
    async with db_session() as conn:
        cursor = await conn.execute(
            "SELECT * FROM history WHERE id = ? AND user_id = ?",
            (history_id, user_id),
        )
        row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gecmis kaydi bulunamadi.")
    return _row_to_item(row)


@router.delete("/{history_id}")
async def delete_history_item(
    history_id: int,
    user_id: int = Depends(get_current_user_id),
):
    async with db_session() as conn:
        cursor = await conn.execute(
            "DELETE FROM history WHERE id = ? AND user_id = ?",
            (history_id, user_id),
        )
        await conn.commit()
        deleted = cursor.rowcount

    if deleted == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gecmis kaydi bulunamadi.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{history_id}/resummarize", response_model=ProcessResponse)
async def resummarize_history_item(
    history_id: int,
    body: ResummarizeRequest,
    user_id: int = Depends(get_current_user_id),
    settings: Settings = Depends(get_settings),
) -> ProcessResponse:
    async with db_session() as conn:
        cursor = await conn.execute(
            "SELECT * FROM history WHERE id = ? AND user_id = ?",
            (history_id, user_id),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gecmis kaydi bulunamadi.")

        summaries = await build_summaries(
            settings=settings,
            model=settings.openrouter_summary_model,
            transcript=row["transcript"],
            summary_type=body.summary_type,
            language=body.summary_language.value,
        )

        insert_cursor = await conn.execute(
            """INSERT INTO history
               (user_id, source_kind, youtube_url, filename, transcript,
                timestamped_transcript, summaries_json, summary_language)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                row["source_kind"],
                row["youtube_url"],
                row["filename"],
                row["transcript"],
                row["timestamped_transcript"],
                json.dumps(summaries.model_dump(), ensure_ascii=False),
                body.summary_language.value,
            ),
        )
        await conn.commit()
        new_history_id = insert_cursor.lastrowid

    return ProcessResponse(
        id=new_history_id,
        source_kind=row["source_kind"],
        transcript_source=settings.openrouter_summary_model,
        language_hint=None,
        transcript=row["transcript"],
        timestamped_transcript=row["timestamped_transcript"],
        summaries=summaries,
        summary_language=body.summary_language.value,
    )
