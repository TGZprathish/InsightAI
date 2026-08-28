"""Dashboards API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.dashboard import Dashboard
from app.models.dashboard_widget import DashboardWidget
from app.models.project import Project
from app.schemas.dashboard import (
    DashboardCreate, DashboardResponse, DashboardUpdate,
    WidgetCreate, WidgetUpdate, WidgetResponse,
)

router = APIRouter(tags=["Dashboards"])


@router.post(
    "/projects/{project_id}/dashboards",
    response_model=DashboardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard(
    project_id: UUID,
    body: DashboardCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new dashboard."""
    # Verify project access
    proj = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    dashboard = Dashboard(
        project_id=project_id,
        dataset_id=body.dataset_id,
        name=body.name,
        is_auto_generated=False,
        created_by=current_user.user_id,
    )
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return DashboardResponse.model_validate(dashboard)


@router.get("/dashboards/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a dashboard with its widgets."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.widgets))
        .join(Project)
        .where(
            Dashboard.id == dashboard_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    resp = DashboardResponse.model_validate(dashboard)
    resp.widgets = [WidgetResponse.model_validate(w) for w in dashboard.widgets]
    return resp


@router.patch("/dashboards/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: UUID,
    body: DashboardUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update dashboard name/layout."""
    result = await db.execute(
        select(Dashboard)
        .join(Project)
        .where(
            Dashboard.id == dashboard_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)

    await db.flush()
    await db.refresh(dashboard)
    return DashboardResponse.model_validate(dashboard)


@router.post(
    "/dashboards/{dashboard_id}/widgets",
    response_model=WidgetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_widget(
    dashboard_id: UUID,
    body: WidgetCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a widget to a dashboard."""
    result = await db.execute(
        select(Dashboard)
        .join(Project)
        .where(
            Dashboard.id == dashboard_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    widget = DashboardWidget(
        dashboard_id=dashboard_id,
        widget_type=body.widget_type,
        analysis_id=body.analysis_id,
        config=body.config,
        position=body.position,
    )
    db.add(widget)
    await db.flush()
    await db.refresh(widget)
    return WidgetResponse.model_validate(widget)


@router.patch("/widgets/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: UUID,
    body: WidgetUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a widget."""
    result = await db.execute(
        select(DashboardWidget)
        .join(Dashboard)
        .join(Project)
        .where(
            DashboardWidget.id == widget_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(widget, field, value)

    await db.flush()
    await db.refresh(widget)
    return WidgetResponse.model_validate(widget)


@router.delete("/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_widget(
    widget_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a widget."""
    result = await db.execute(
        select(DashboardWidget)
        .join(Dashboard)
        .join(Project)
        .where(
            DashboardWidget.id == widget_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    await db.delete(widget)
    await db.flush()
    return None
