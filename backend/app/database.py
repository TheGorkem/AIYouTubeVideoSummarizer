from __future__ import annotations

from contextlib import asynccontextmanager as async_cm
from typing import AsyncGenerator

import aiosqlite

_DB_PATH: str = ""


def set_db_path(path: str) -> None:
    global _DB_PATH
    _DB_PATH = path


def get_db_path() -> str:
    return _DB_PATH


async def get_connection() -> aiosqlite.Connection:
    conn = await aiosqlite.connect(_DB_PATH)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA foreign_keys=ON")
    return conn


@async_cm
async def db_session() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Async context manager for DB connections. Auto-closes on exit."""
    conn = await get_connection()
    try:
        yield conn
    finally:
        await conn.close()


async def init_db() -> None:
    async with db_session() as conn:
        # --- Core tables (columns that existed from the start) ---
        await conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       TEXT    NOT NULL UNIQUE,
                password_hash TEXT  NOT NULL,
                display_name TEXT   NOT NULL DEFAULT '',
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER,
                source_kind TEXT    NOT NULL,
                youtube_url TEXT,
                filename    TEXT,
                transcript  TEXT    NOT NULL,
                timestamped_transcript TEXT,
                summaries_json TEXT NOT NULL DEFAULT '{}',
                created_at  TEXT   NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_history_user
                ON history(user_id, created_at DESC);
            """
        )

        # --- Migration: add columns that were introduced later ---
        columns_cursor = await conn.execute("PRAGMA table_info(history)")
        columns = {row["name"] for row in await columns_cursor.fetchall()}

        if "anonymous_session_id" not in columns:
            await conn.execute("ALTER TABLE history ADD COLUMN anonymous_session_id TEXT")
        if "summary_language" not in columns:
            await conn.execute("ALTER TABLE history ADD COLUMN summary_language TEXT NOT NULL DEFAULT 'tr'")
        if "share_token" not in columns:
            await conn.execute("ALTER TABLE history ADD COLUMN share_token TEXT")

        await conn.commit()

        # --- Indexes that depend on migrated columns ---
        await conn.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_history_anonymous_session
                ON history(anonymous_session_id, created_at DESC);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_history_share_token
                ON history(share_token) WHERE share_token IS NOT NULL;
            """
        )
