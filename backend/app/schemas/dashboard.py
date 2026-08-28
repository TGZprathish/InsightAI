"""Dashboard schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class WidgetCreate(BaseModel):
    widget_type: str
    analysis_id: Optional[UUID] = None
    config: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, Any]] = None  # {x, y, w, h}


class WidgetUpdate(BaseModel):
    widget_type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, Any]] = None


class WidgetResponse(BaseModel):
    id: UUID
    dashboard_id: UUID
    widget_type: str
    analysis_id: Optional[UUID] = None
    config: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class DashboardCreate(BaseModel):
    name: str
    dataset_id: Optional[UUID] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None


class DashboardResponse(BaseModel):
    id: UUID
    project_id: UUID
    dataset_id: Optional[UUID] = None
    name: str
    is_auto_generated: bool
    layout: Optional[Dict[str, Any]] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    widgets: Optional[List[WidgetResponse]] = None

    model_config = {"from_attributes": True}
