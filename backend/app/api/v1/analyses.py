"""Analysis API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser, PaginationParams
from app.models.analysis import Analysis
from app.models.dataset_version import DatasetVersion
from app.models.dataset import Dataset
from app.models.project import Project
from app.schemas.analysis import AnalysisCreate, AnalysisResponse
from app.schemas.common import PaginatedResponse

router = APIRouter(tags=["Analysis"])


@router.post(
    "/datasets/{dataset_id}/versions/{version_id}/analyses",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_analysis(
    dataset_id: UUID,
    version_id: UUID,
    body: AnalysisCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create and enqueue a new analysis."""
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
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    analysis = Analysis(
        dataset_version_id=version_id,
        analysis_type=body.analysis_type,
        params=body.params,
        status="pending",
        created_by=current_user.user_id,
    )
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)

    # Enqueue analysis task
    try:
        from app.tasks.analysis import run_analysis_task
        run_analysis_task.delay(str(analysis.id))
    except Exception as e:
        print(f"Celery dispatch note: {e}")

    return AnalysisResponse.model_validate(analysis)


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an analysis by ID."""
    result = await db.execute(
        select(Analysis)
        .join(DatasetVersion)
        .join(Dataset)
        .join(Project)
        .where(
            Analysis.id == analysis_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return AnalysisResponse.model_validate(analysis)


@router.get(
    "/datasets/{dataset_id}/analyses",
    response_model=PaginatedResponse[AnalysisResponse],
)
async def list_analyses(
    dataset_id: UUID,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all analyses for a dataset."""
    base_query = (
        select(Analysis)
        .join(DatasetVersion)
        .join(Dataset)
        .join(Project)
        .where(
            Dataset.id == dataset_id,
            Project.organization_id == current_user.organization_id,
        )
    )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(Analysis.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    analyses = result.scalars().all()

    return PaginatedResponse(
        items=[AnalysisResponse.model_validate(a) for a in analyses],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
