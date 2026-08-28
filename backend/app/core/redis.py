"""Redis client singleton for caching and session management."""

import redis.asyncio as aioredis

from app.core import settings

redis_client = aioredis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
)


async def get_redis() -> aioredis.Redis:
    """FastAPI dependency that returns the Redis client."""
    return redis_client
