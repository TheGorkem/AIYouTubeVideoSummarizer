from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, set_db_path
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers.auth import router as auth_router
from app.routers.history import router as history_router
from app.routers.process import router as process_router
from app.routers.share import router as share_router
from app.routers.stream import router as stream_router

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI):
    db_path = settings.database_path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    set_db_path(db_path)
    await init_db()
    yield


app = FastAPI(
    title="AI Video Summarizer API",
    version="0.3.0",
    description="YouTube URL veya dosya yukleyerek transcript ve AI ozet uretir.",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)
app.include_router(stream_router)
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(share_router)
