from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.database import db_session
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserInfo
from app.services.auth import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


async def merge_anonymous_history(user_id: int, anonymous_session_id: str | None) -> None:
    if not anonymous_session_id:
        return
    async with db_session() as conn:
        await conn.execute(
            """
            UPDATE history
            SET user_id = ?, anonymous_session_id = NULL
            WHERE anonymous_session_id = ? AND user_id IS NULL
            """,
            (user_id, anonymous_session_id),
        )
        await conn.commit()


@router.post("/register", response_model=AuthResponse)
async def register(
    body: RegisterRequest,
    anonymous_session_id: str | None = Header(default=None, alias="X-Anonymous-Session"),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    async with db_session() as conn:
        existing = await conn.execute(
            "SELECT id FROM users WHERE email = ?", (body.email,)
        )
        if await existing.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu email adresi zaten kayitli.",
            )
        cursor = await conn.execute(
            "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
            (body.email, hash_password(body.password), body.display_name),
        )
        await conn.commit()
        user_id = cursor.lastrowid

    await merge_anonymous_history(user_id, anonymous_session_id)
    token = create_access_token(user_id, settings)
    return AuthResponse(
        token=token,
        user=UserInfo(id=user_id, email=body.email, display_name=body.display_name),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    anonymous_session_id: str | None = Header(default=None, alias="X-Anonymous-Session"),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    async with db_session() as conn:
        cursor = await conn.execute(
            "SELECT id, password_hash, display_name FROM users WHERE email = ?",
            (body.email,),
        )
        row = await cursor.fetchone()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email veya sifre hatali.",
        )

    user_id = row["id"]
    await merge_anonymous_history(user_id, anonymous_session_id)
    token = create_access_token(user_id, settings)
    return AuthResponse(
        token=token,
        user=UserInfo(
            id=user_id,
            email=body.email,
            display_name=row["display_name"],
        ),
    )


@router.get("/me", response_model=UserInfo)
async def me(user_id: int = Depends(get_current_user_id)) -> UserInfo:
    async with db_session() as conn:
        cursor = await conn.execute(
            "SELECT id, email, display_name FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanici bulunamadi.",
        )
    return UserInfo(id=row["id"], email=row["email"], display_name=row["display_name"])
