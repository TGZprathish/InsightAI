"""Celery application configuration."""

from celery import Celery
from app.core import settings

celery = Celery(
    "insightai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.ingestion.*": {"queue": "ingestion"},
        "app.tasks.profiling.*": {"queue": "profiling"},
        "app.tasks.cleaning.*": {"queue": "cleaning"},
        "app.tasks.analysis.*": {"queue": "analysis"},
        "app.tasks.ml.*": {"queue": "ml"},
        "app.tasks.reports.*": {"queue": "reports"},
        "app.tasks.ai_tasks.*": {"queue": "ai"},
    },
    task_default_queue="ingestion",
    task_default_retry_delay=5,
    task_max_retries=3,
)

# Auto-discover tasks
celery.autodiscover_tasks([
    "app.tasks",
])
