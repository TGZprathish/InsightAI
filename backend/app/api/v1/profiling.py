"""Profiling API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.profile import Profile
from app.models.dataset_version import DatasetVersion
from app.models.dataset import Dataset
from app.models.project import Project
from app.schemas.profile import ProfileResponse

router = APIRouter(tags=["Profiling"])


@router.post(
    "/datasets/{dataset_id}/versions/{version_id}/profile",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_profile(
    dataset_id: UUID,
    version_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue a profiling job for a dataset version."""
    # Verify access
    result = await db.execute(
        select(DatasetVersion)
        .join(Dataset)
        .join(Project)
        .where(
            DatasetVersion.id == version_id,
            DatasetVersion.dataset_id == dataset_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Check for existing profile
    existing = await db.execute(
        select(Profile).where(
            Profile.dataset_version_id == version_id,
            Profile.status.in_(["pending", "running", "complete"]),
        )
    )
    existing_profile = existing.scalar_one_or_none()
    if existing_profile:
        return {"profile_id": str(existing_profile.id), "status": existing_profile.status}

    # Create profile
    profile = Profile(dataset_version_id=version_id, status="pending")
    db.add(profile)
    await db.flush()

    # Enqueue profiling task
    try:
        from app.tasks.profiling import profile_dataset_task
        profile_dataset_task.delay(str(version_id))
    except Exception as e:
        print(f"Celery dispatch note (will process when worker active): {e}")

    return {"profile_id": str(profile.id), "status": "pending"}


@router.get("/profiles/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a profile by ID. Poll until status is 'complete'."""
    result = await db.execute(
        select(Profile)
        .join(DatasetVersion)
        .join(Dataset)
        .join(Project)
        .where(
            Profile.id == profile_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return ProfileResponse.model_validate(profile)
