"""Generic job status polling and SSE monitoring endpoint."""

from uuid import UUID
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.profile import Profile
from app.models.cleaning_job import CleaningJob
from app.models.analysis import Analysis
from app.models.ml_model import MLModel
from app.models.report import Report
from app.models.dataset_version import DatasetVersion
from app.models.dataset import Dataset
from app.models.project import Project

router = APIRouter(tags=["Jobs"])


@router.get("/jobs/{job_type}/{job_id}/status")
async def get_job_status(
    job_type: str,
    job_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Poll async job status across any worker queue (profile, cleaning, analysis, ml, report)."""
    job_type_lower = job_type.lower()

    if job_type_lower == "profile":
        result = await db.execute(
            select(Profile)
            .join(DatasetVersion)
            .join(Dataset)
            .join(Project)
            .where(
                Profile.id == job_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile job not found")
        return {
            "job_id": str(item.id),
            "job_type": "profile",
            "status": item.status,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "has_summary": bool(item.summary),
        }

    elif job_type_lower in ["cleaning", "cleaning_job"]:
        result = await db.execute(
            select(CleaningJob)
            .join(DatasetVersion, CleaningJob.dataset_version_id == DatasetVersion.id)
            .join(Dataset)
            .join(Project)
            .where(
                CleaningJob.id == job_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cleaning job not found")
        return {
            "job_id": str(item.id),
            "job_type": "cleaning",
            "status": item.status,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "result_dataset_version_id": str(item.result_dataset_version_id) if item.result_dataset_version_id else None,
        }

    elif job_type_lower == "analysis":
        result = await db.execute(
            select(Analysis)
            .join(DatasetVersion)
            .join(Dataset)
            .join(Project)
            .where(
                Analysis.id == job_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis job not found")
        return {
            "job_id": str(item.id),
            "job_type": "analysis",
            "status": item.status,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "has_result": bool(item.result),
        }

    elif job_type_lower in ["ml", "model", "ml_model"]:
        result = await db.execute(
            select(MLModel)
            .join(Analysis)
            .join(DatasetVersion)
            .join(Dataset)
            .join(Project)
            .where(
                MLModel.id == job_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ML Model job not found")
        return {
            "job_id": str(item.id),
            "job_type": "ml",
            "status": "complete" if item.metrics else "running",
            "has_metrics": bool(item.metrics),
            "model_type": item.model_type,
        }

    elif job_type_lower == "report":
        result = await db.execute(
            select(Report)
            .join(Project)
            .where(
                Report.id == job_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found")
        return {
            "job_id": str(item.id),
            "job_type": "report",
            "status": item.status,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "has_export": bool(item.export_uris),
        }

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported job type: {job_type}")
