from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers.process import router as process_router

settings = get_settings()

app = FastAPI(
    title="AI Video Summarizer API",
    version="0.1.0",
    description="YouTube URL veya dosya yukleyerek transcript ve AI ozet uretir.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)
