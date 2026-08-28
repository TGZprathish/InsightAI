"""Cleaning API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.cleaning_job import CleaningJob
from app.models.dataset_version import DatasetVersion
from app.models.dataset import Dataset
from app.models.project import Project
from app.schemas.cleaning import CleaningJobResponse, CleaningApplyRequest

router = APIRouter(tags=["Cleaning"])


@router.post(
    "/datasets/{dataset_id}/versions/{version_id}/cleaning/suggest",
    response_model=CleaningJobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def suggest_cleaning(
    dataset_id: UUID,
    version_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate cleaning suggestions for a dataset version."""
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
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Create cleaning job with mock suggestions
    mock_rules = [
        {
            "id": "rule_1",
            "type": "drop_empty_rows",
            "column": None,
            "params": {},
            "rationale": "Remove rows where all columns are empty to reduce noise",
            "affected_row_estimate": 12,
        },
        {
            "id": "rule_2",
            "type": "trim_whitespace",
            "column": None,
            "params": {},
            "rationale": "Trim leading/trailing whitespace from all string columns for consistency",
            "affected_row_estimate": 45,
        },
        {
            "id": "rule_3",
            "type": "deduplicate",
            "column": None,
            "params": {"keep": "first"},
            "rationale": "Remove exact duplicate rows to ensure data integrity",
            "affected_row_estimate": 8,
        },
    ]

    job = CleaningJob(
        dataset_version_id=version_id,
        status="suggested",
        suggested_rules=mock_rules,
        created_by=current_user.user_id,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return CleaningJobResponse.model_validate(job)


@router.post(
    "/cleaning-jobs/{job_id}/apply",
    response_model=CleaningJobResponse,
)
async def apply_cleaning(
    job_id: UUID,
    body: CleaningApplyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply approved cleaning rules to create a new cleaned dataset version."""
    result = await db.execute(
        select(CleaningJob)
        .join(DatasetVersion)
        .join(Dataset)
        .join(Project)
        .where(
            CleaningJob.id == job_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cleaning job not found")

    if job.status != "suggested":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cleaning job is not in 'suggested' state",
        )

    # Filter to approved rules
    approved_rules = [
        r for r in (job.suggested_rules or [])
        if r["id"] in body.approved_rule_ids
    ]
    job.applied_rules = approved_rules
    job.status = "applied"

    # Enqueue async cleaning execution task
    try:
        from app.tasks.cleaning import apply_cleaning_job
        apply_cleaning_job.delay(str(job.id))
    except Exception as e:
        print(f"Celery dispatch note: {e}")

    await db.flush()
    await db.refresh(job)
    return CleaningJobResponse.model_validate(job)


@router.get("/cleaning-jobs/{job_id}", response_model=CleaningJobResponse)
async def get_cleaning_job(
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a cleaning job by ID."""
    result = await db.execute(
        select(CleaningJob)
        .join(DatasetVersion)
        .join(Dataset)
        .join(Project)
        .where(
            CleaningJob.id == job_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cleaning job not found")
    return CleaningJobResponse.model_validate(job)
