"""Khabo Kothay? FastAPI Server Main Entrypoint."""

import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.errors import AppError, app_error_handler
from .routers import health

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Python FastAPI backend for Khabo Kothay? Dhaka Restaurant Finder",
)

# CORS Middleware - Restrict origins when credentials are enabled
allowed_origins = [
    "https://khabo-kothay-backend.onrender.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID Middleware
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-Id") or f"req-{uuid.uuid4().hex[:8]}"
    request.state.request_id = req_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = req_id
    return response


# Register Custom Error Handlers
app.add_exception_handler(AppError, app_error_handler)

# Include Routers under /api/v1
app.include_router(health.router, prefix=settings.api_v1_prefix)
# Mount health alias at /api/health for backward compatibility
app.include_router(health.router, prefix="/api")
