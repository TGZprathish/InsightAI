"""API dependencies — authentication, authorization, and common injections."""

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

security_scheme = HTTPBearer()


class CurrentUser:
    """Decoded JWT payload for the current request."""

    def __init__(self, user_id: UUID, organization_id: UUID, role: str):
        self.user_id = user_id
        self.organization_id = organization_id
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> CurrentUser:
    """Validate JWT and return the current user context."""
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        return CurrentUser(
            user_id=UUID(payload["sub"]),
            organization_id=UUID(payload["org_id"]),
            role=payload["role"],
        )
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def require_role(*allowed_roles: str):
    """Factory for role-based access control dependency."""

    async def check_role(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        # org_owner has access to everything
        if current_user.role == "org_owner":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized for this action",
            )
        return current_user

    return check_role


async def get_user_from_db(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Fetch the full User ORM object for the authenticated user."""
    result = await db.execute(
        select(User).where(
            User.id == current_user.user_id,
            User.is_active == True,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


async def require_admin_email(
    user: User = Depends(get_user_from_db),
) -> User:
    """Dependency verifying user email is in the allowed admin whitelist."""
    from app.core.config import settings
    allowed = settings.admin_allowed_emails_list
    if allowed and user.email.lower() not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: '{user.email}' is not in the allowed administrator whitelist.",
        )
    return user


# Pagination parameters
class PaginationParams:
    def __init__(self, page: int = 1, page_size: int = 20):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 100)
        self.offset = (self.page - 1) * self.page_size
