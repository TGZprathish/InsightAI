"""Core configuration module."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── App ───────────────────────────────────────────────────
    APP_NAME: str = "InsightAI"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:80,https://insight-ai-mu-wheat.vercel.app"
    CORS_ORIGIN_REGEX: str = r"^https://.*\.vercel\.app$"

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./insightai.db"

    # Sync URL for Alembic and Celery workers (non-async)
    @property
    def DATABASE_URL_SYNC(self) -> str:
        if "sqlite+aiosqlite" in self.DATABASE_URL:
            return self.DATABASE_URL.replace("sqlite+aiosqlite", "sqlite")
        return self.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2").replace("asyncpg", "psycopg2")

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── Object Storage (S3 / MinIO) ──────────────────────────
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "insightai-data"
    S3_REGION: str = "us-east-1"

    # ── JWT / Auth ────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI Engine Configuration ──────────────────────────────
    AI_PROVIDER: str = "gemini"  # gemini | anthropic
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_INPUT_PRICE_PER_TOKEN: float = 0.0000001    # $0.10 / MTok
    GEMINI_OUTPUT_PRICE_PER_TOKEN: float = 0.0000004   # $0.40 / MTok

    # ── Anthropic AI ─────────────────────────────────────────
    ANTHROPIC_API_KEY: str = "sk-ant-mock-key"
    ANTHROPIC_MODEL: str = "claude-sonnet-5"
    ANTHROPIC_INPUT_PRICE_PER_TOKEN: float = 0.000002   # $2.00 / MTok
    ANTHROPIC_OUTPUT_PRICE_PER_TOKEN: float = 0.00001   # $10.00 / MTok

    AI_MOCK_MODE: bool = False

    # ── Observability ────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── Upload Limits ────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 200

    # ── Admin Access Whitelist ──────────────────────────────
    ADMIN_ALLOWED_EMAILS: str = "admin@insightai.io,owner@insightai.io,prathishska@gmail.com"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def admin_allowed_emails_list(self) -> List[str]:
        return [email.strip().lower() for email in self.ADMIN_ALLOWED_EMAILS.split(",") if email.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    model_config = {
        "env_file": (".env", "../.env", ".env.example", "../.env.example"),
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
