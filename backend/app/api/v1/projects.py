"""Projects API routes."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser, PaginationParams
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=PaginatedResponse[ProjectResponse])
async def list_projects(
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all projects created by the current user."""
    base_query = select(Project).where(
        Project.created_by == current_user.user_id,
        Project.archived_at.is_(None),
    )

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar()

    # Fetch page
    result = await db.execute(
        base_query.order_by(Project.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    projects = result.scalars().all()

    return PaginatedResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    project = Project(
        organization_id=current_user.organization_id,
        name=body.name,
        description=body.description,
        created_by=current_user.user_id,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a project by ID."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.created_by == current_user.user_id,
            Project.archived_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.created_by == current_user.user_id,
            Project.archived_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a project workspace and all its child datasets, versions, and storage files."""
    import os
    from app.models.dataset import Dataset
    from app.models.dataset_version import DatasetVersion
    from app.models.cleaning_job import CleaningJob
    from app.models.ai_conversation import AiConversation
    from app.services.storage import storage_service

    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.created_by == current_user.user_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # 1. Fetch linked datasets
    ds_res = await db.execute(
        select(Dataset).options(selectinload(Dataset.versions)).where(Dataset.project_id == project.id)
    )
    datasets = ds_res.scalars().all()

    # 2. Cleanup dataset versions, cleaning jobs, physical files, AI convos
    for ds in datasets:
        for ver in ds.versions:
            try:
                storage_service.delete_file(ver.storage_uri)
            except Exception as ex:
                print(f"Project file cleanup note: {ex}")

            await db.execute(
                delete(CleaningJob).where(
                    (CleaningJob.dataset_version_id == ver.id) |
                    (CleaningJob.result_dataset_version_id == ver.id)
                )
            )

        await db.execute(delete(AiConversation).where(AiConversation.dataset_id == ds.id))

    # 3. Delete project record
    await db.delete(project)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
