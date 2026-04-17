from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Default limits: (max_requests, window_seconds)
DEFAULT_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/auth/login": (5, 60),
    "/api/v1/auth/register": (3, 60),
    "/api/v1/process": (10, 60),
    "/api/v1/process/stream": (10, 60),
}


class _TokenBucket:
    __slots__ = ("tokens", "max_tokens", "refill_rate", "last_refill")

    def __init__(self, max_tokens: int, refill_rate: float):
        self.tokens = float(max_tokens)
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate  # tokens per second
        self.last_refill = time.monotonic()

    def consume(self) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory IP-based rate limiter using token bucket algorithm."""

    def __init__(
        self,
        app: ASGIApp,
        limits: dict[str, tuple[int, int]] | None = None,
    ):
        super().__init__(app)
        self.limits = limits or DEFAULT_LIMITS
        # key: (ip, path) -> TokenBucket
        self._buckets: dict[tuple[str, str], _TokenBucket] = {}

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_bucket(self, ip: str, path: str, max_requests: int, window: int) -> _TokenBucket:
        key = (ip, path)
        if key not in self._buckets:
            refill_rate = max_requests / window
            self._buckets[key] = _TokenBucket(max_tokens=max_requests, refill_rate=refill_rate)
        return self._buckets[key]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path.rstrip("/")

        if path in self.limits and request.method == "POST":
            max_requests, window = self.limits[path]
            ip = self._get_client_ip(request)
            bucket = self._get_bucket(ip, path, max_requests, window)

            if not bucket.consume():
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Cok fazla istek gonderdiniz. Lutfen biraz bekleyin.",
                    },
                )

        return await call_next(request)
