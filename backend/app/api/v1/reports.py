"""Reports API routes."""

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser, PaginationParams
from app.models.report import Report
from app.models.project import Project
from app.schemas.report import (
    ReportCreate, ReportResponse, ReportExportRequest, ReportExportResponse,
)
from app.schemas.common import PaginatedResponse

router = APIRouter(tags=["Reports"])


@router.post(
    "/projects/{project_id}/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_report(
    project_id: UUID,
    body: ReportCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new analytics report."""
    proj = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Mock report generation
    mock_content = {
        "executive_summary": "This dataset reveals strong growth trends across key business metrics, with revenue increasing 15% quarter-over-quarter and customer acquisition costs declining by 8%.",
        "key_metrics": [
            {"label": "Total Revenue", "value": "$2.4M", "trend": "up", "source_analysis_id": "mock"},
            {"label": "Customer Count", "value": "12,450", "trend": "up", "source_analysis_id": "mock"},
            {"label": "Avg Order Value", "value": "$192", "trend": "flat", "source_analysis_id": "mock"},
            {"label": "Churn Rate", "value": "3.2%", "trend": "down", "source_analysis_id": "mock"},
        ],
        "notable_trends": [
            {
                "title": "Revenue Growth Acceleration",
                "narrative": "Revenue growth has accelerated from 8% to 15% QoQ, driven primarily by enterprise segment expansion.",
                "source_analysis_id": "mock",
            },
        ],
        "anomalies": [
            {
                "title": "Unusual Spike in West Region",
                "narrative": "The West region showed a 45% increase in orders during week 37, significantly deviating from the seasonal pattern.",
                "severity": "medium",
                "source_analysis_id": "mock",
            },
        ],
        "recommendations": [
            {
                "title": "Expand Enterprise Sales Team",
                "rationale": "Enterprise segment shows 3x higher LTV with declining acquisition costs.",
                "confidence": "high",
            },
        ],
    }

    report = Report(
        project_id=project_id,
        dataset_version_id=body.dataset_version_id,
        title=body.title or "Analytics Report",
        status="ready",
        content_json=mock_content,
        generated_by=current_user.user_id,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return ReportResponse.model_validate(report)


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a report by ID."""
    result = await db.execute(
        select(Report)
        .join(Project)
        .where(
            Report.id == report_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportResponse.model_validate(report)


@router.post("/reports/{report_id}/export", response_model=ReportExportResponse)
async def export_report(
    report_id: UUID,
    body: ReportExportRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a report to PDF/DOCX/PPTX."""
    result = await db.execute(
        select(Report)
        .join(Project)
        .where(
            Report.id == report_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Dispatch async PDF generation if requested
    if body.format.lower() == "pdf":
        try:
            from app.tasks.reports import export_report_pdf_task
            export_report_pdf_task.delay(str(report.id))
        except Exception as e:
            print(f"Celery dispatch note: {e}")

    # Set initial export URI
    export_uri = f"/exports/reports/{report_id}.{body.format}"

    if not report.export_uris:
        report.export_uris = {}
    report.export_uris[body.format] = export_uri
    await db.flush()

    return ReportExportResponse(export_uri=export_uri)


@router.get(
    "/projects/{project_id}/reports",
    response_model=PaginatedResponse[ReportResponse],
)
async def list_reports(
    project_id: UUID,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reports for a project."""
    base_query = (
        select(Report)
        .join(Project)
        .where(
            Report.project_id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(Report.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    reports = result.scalars().all()

    return PaginatedResponse(
        items=[ReportResponse.model_validate(r) for r in reports],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
