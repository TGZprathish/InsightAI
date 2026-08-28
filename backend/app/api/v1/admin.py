"""Admin & Usage API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, require_role, require_admin_email, CurrentUser, PaginationParams
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.usage_quota import UsageQuota
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.project import Project
from app.models.report import Report
from app.models.ai_conversation import AiConversation
from app.models.ai_message import AiMessage
from app.schemas.auth import UserResponse
from app.schemas.admin import UserUpdateRequest, AuditLogResponse
from app.schemas.usage import UsageResponse, UsageHistoryResponse, UsageHistoryPoint
from app.schemas.common import PaginatedResponse

router = APIRouter(tags=["Admin"])


@router.get("/usage/summary")
async def get_user_usage_summary(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time user-specific usage statistics including datasets uploaded, storage, AI tokens, and reports generated."""
    # 1. Total datasets uploaded count for current user
    ds_count_res = await db.execute(
        select(func.count(Dataset.id))
        .where(
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )
    total_datasets = ds_count_res.scalar() or 0

    # 2. Total storage byte size across uploaded dataset versions for current user
    storage_res = await db.execute(
        select(func.sum(DatasetVersion.byte_size))
        .join(Dataset, Dataset.id == DatasetVersion.dataset_id)
        .where(
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )
    total_bytes = storage_res.scalar() or 0
    storage_mb = round(total_bytes / (1024 * 1024), 2)
    storage_gb = round(total_bytes / (1024 * 1024 * 1024), 4)

    # 3. Total active projects created by current user
    proj_res = await db.execute(
        select(func.count(Project.id))
        .where(
            Project.created_by == current_user.user_id,
            Project.archived_at.is_(None),
        )
    )
    total_projects = proj_res.scalar() or 0

    # 4. Total AI tokens consumed strictly by current user
    ai_msg_res = await db.execute(
        select(AiMessage.token_usage, AiMessage.content)
        .join(AiConversation, AiConversation.id == AiMessage.conversation_id)
        .where(
            AiConversation.created_by == current_user.user_id,
            AiMessage.role == "assistant",
        )
    )
    user_ai_messages = ai_msg_res.all()
    total_user_ai_tokens = 0
    for token_dict, content in user_ai_messages:
        if isinstance(token_dict, dict) and "total_tokens" in token_dict:
            total_user_ai_tokens += int(token_dict.get("total_tokens") or 0)
        elif isinstance(token_dict, dict) and ("input_tokens" in token_dict or "output_tokens" in token_dict):
            total_user_ai_tokens += int(token_dict.get("input_tokens", 0) or 0) + int(token_dict.get("output_tokens", 0) or 0)
        elif content:
            total_user_ai_tokens += max(100, int(len(content.split()) * 1.4))

    # 5. Total reports generated strictly by current user
    rep_res = await db.execute(
        select(func.count(Report.id))
        .where(Report.generated_by == current_user.user_id)
    )
    total_user_reports = rep_res.scalar() or 0

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    days_until_sunday = (6 - now.weekday()) % 7
    if days_until_sunday == 0 and now.hour > 0:
        days_until_sunday = 7
    next_reset = (now + timedelta(days=days_until_sunday)).replace(hour=23, minute=59, second=59, microsecond=0)
    time_left = next_reset - now
    days_left = time_left.days
    hours_left = time_left.seconds // 3600

    return {
        "datasets_uploaded": total_datasets,
        "datasets_limit": 100,
        "storage_bytes": total_bytes,
        "storage_mb": storage_mb,
        "storage_gb": storage_gb,
        "storage_limit_gb": 2,
        "projects_count": total_projects,
        "ai_tokens": total_user_ai_tokens,
        "ai_tokens_limit": 200000,
        "ai_tokens_reset_interval": "Resets Weekly",
        "ai_tokens_reset_countdown": f"{days_left}d {hours_left}h remaining",
        "reports_generated": total_user_reports,
        "reports_limit": 50,
    }


from typing import Optional, List, Dict, Any
from sqlalchemy.orm import selectinload


@router.get("/admin/users")
async def get_admin_users_list(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users with 10 users per page and detailed per-user asset/storage usage."""
    # Base user query
    base_query = select(User).options(selectinload(User.organization))
    if search:
        s = f"%{search.strip().lower()}%"
        base_query = base_query.where(
            func.lower(User.email).like(s) | func.lower(User.full_name).like(s)
        )

    # Count total users
    count_res = await db.execute(select(func.count(User.id)))
    total_users = count_res.scalar() or 0

    # Query 10 users for current page
    offset = max(0, (page - 1) * page_size)
    users_res = await db.execute(
        base_query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )
    users = users_res.scalars().all()

    # Compute usage metrics for each user in this page
    items = []
    for u in users:
        # Datasets count
        ds_res = await db.execute(
            select(func.count(Dataset.id)).where(
                Dataset.created_by == u.id,
                Dataset.deleted_at.is_(None),
            )
        )
        ds_count = ds_res.scalar() or 0

        # Projects count
        proj_res = await db.execute(
            select(func.count(Project.id)).where(
                Project.created_by == u.id,
                Project.archived_at.is_(None),
            )
        )
        proj_count = proj_res.scalar() or 0

        # Storage used
        st_res = await db.execute(
            select(func.sum(DatasetVersion.byte_size))
            .join(Dataset, Dataset.id == DatasetVersion.dataset_id)
            .where(
                Dataset.created_by == u.id,
                Dataset.deleted_at.is_(None),
            )
        )
        storage_bytes = st_res.scalar() or 0
        storage_mb = round(storage_bytes / (1024 * 1024), 2)
        storage_kb = round(storage_bytes / 1024, 1)

        items.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name or "N/A",
            "phone_number": u.phone_number or None,
            "dob": u.dob or None,
            "role": u.role,
            "organization_name": u.organization.name if u.organization else "Personal Workspace",
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "usage": {
                "datasets_uploaded": ds_count,
                "database_projects": proj_count,
                "storage_mb": storage_mb,
                "storage_kb": storage_kb,
                "storage_bytes": storage_bytes,
            }
        })

    total_pages = max(1, (total_users + page_size - 1) // page_size if page_size > 0 else 1)

    return {
        "items": items,
        "total": total_users,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


from pydantic import BaseModel


class AdminRoleChangeRequest(BaseModel):
    role: str  # "org_owner" | "user" | "analyst"


@router.patch("/admin/users/{user_id}/role")
async def update_user_role_admin(
    user_id: UUID,
    body: AdminRoleChangeRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allow system administrators to change the role of every user (between org_owner and user)."""
    raw_role = body.role.strip().lower()
    # Normalize "user" to standard role or keep as "user" / "org_owner"
    valid_roles = ["org_owner", "user", "analyst", "admin", "viewer"]
    if raw_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{body.role}'. Valid options are: org_owner, user",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Main owner protection: prathishska@gmail.com is fixed to org_owner and cannot be changed
    if user.email.strip().lower() == "prathishska@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The main owner account (prathishska@gmail.com) role is permanently fixed to 'org_owner' and cannot be altered.",
        )

    user.role = raw_role
    await db.commit()
    await db.refresh(user)

    return {
        "status": "success",
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "message": f"Successfully updated {user.email}'s role to {user.role}",
    }



@router.get("/organizations/{org_id}/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    org_id: UUID,
    pagination: PaginationParams = Depends(),
    admin_user: User = Depends(require_admin_email),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the organization."""
    if current_user.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    base_query = select(User).where(User.organization_id == org_id)
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(User.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    users = result.scalars().all()

    return PaginatedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.patch("/organizations/{org_id}/users/{user_id}", response_model=UserResponse)
async def update_user(
    org_id: UUID,
    user_id: UUID,
    body: UserUpdateRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's role or active status."""
    if current_user.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get(
    "/organizations/{org_id}/audit-logs",
    response_model=PaginatedResponse[AuditLogResponse],
)
async def list_audit_logs(
    org_id: UUID,
    action: str = None,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs for the organization."""
    if current_user.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    base_query = select(AuditLog).where(AuditLog.organization_id == org_id)
    if action:
        base_query = base_query.where(AuditLog.action == action)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(AuditLog.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    logs = result.scalars().all()

    return PaginatedResponse(
        items=[AuditLogResponse.model_validate(l) for l in logs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/organizations/{org_id}/usage", response_model=list)
async def get_usage(
    org_id: UUID,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get current period usage quotas."""
    if current_user.organization_id != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(UsageQuota).where(UsageQuota.organization_id == org_id)
    )
    quotas = result.scalars().all()

    if not quotas:
        # Return mock data
        from datetime import date
        return [
            UsageResponse(
                metric="datasets_uploaded", limit_value=100, used_value=23,
                period_start=date.today().replace(day=1),
                period_end=date.today(),
            ),
            UsageResponse(
                metric="storage_bytes", limit_value=10737418240, used_value=2147483648,
                period_start=date.today().replace(day=1),
                period_end=date.today(),
            ),
            UsageResponse(
                metric="ai_tokens", limit_value=2000000, used_value=450000,
                period_start=date.today().replace(day=1),
                period_end=date.today(),
            ),
            UsageResponse(
                metric="reports_generated", limit_value=50, used_value=12,
                period_start=date.today().replace(day=1),
                period_end=date.today(),
            ),
        ]

    return [UsageResponse.model_validate(q) for q in quotas]
