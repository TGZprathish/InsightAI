"""InsightAI FastAPI Application."""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core import settings


# ── Sentry Observability ─────────────────────────────────────
if getattr(settings, "SENTRY_DSN", None):
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=1.0 if settings.APP_DEBUG else 0.2,
            environment=settings.APP_ENV,
        )
    except Exception as e:
        print(f"Sentry init warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Auto-create database tables (fallback for dev)
    try:
        from app.core.database import engine, Base
        import app.models  # Ensure all ORM models are registered
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Database table initialization warning: {e}")
    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Data Analytics & Decision Support System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX if getattr(settings, "CORS_ORIGIN_REGEX", None) else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID Middleware ─────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Global Exception Handler ─────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "internal_error",
                "message": str(exc) if settings.APP_DEBUG else "An internal error occurred",
                "request_id": request_id,
            }
        },
    )


# ── Health Check ──────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}


# ── Register API Routers ─────────────────────────────────────
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.profiling import router as profiling_router
from app.api.v1.cleaning import router as cleaning_router
from app.api.v1.analyses import router as analyses_router
from app.api.v1.ml import router as ml_router
from app.api.v1.dashboards import router as dashboards_router
from app.api.v1.reports import router as reports_router
from app.api.v1.ai_chat import router as ai_chat_router
from app.api.v1.admin import router as admin_router
from app.api.v1.jobs import router as jobs_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(datasets_router, prefix="/api/v1")
app.include_router(profiling_router, prefix="/api/v1")
app.include_router(cleaning_router, prefix="/api/v1")
app.include_router(analyses_router, prefix="/api/v1")
app.include_router(ml_router, prefix="/api/v1")
app.include_router(dashboards_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(ai_chat_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
