"""JWT authentication and password hashing utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
import bcrypt
import hashlib

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password using native bcrypt."""
    pw_bytes = hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    pw_bytes = hashlib.sha256(plain_password.encode("utf-8")).hexdigest().encode("utf-8")
    return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))


def create_access_token(
    user_id: UUID,
    organization_id: UUID,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "org_id": str(organization_id),
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: UUID,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_password_reset_token(
    user_id: UUID,
    email: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT password reset token valid for 30 minutes."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=30)
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "type": "password_reset",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

