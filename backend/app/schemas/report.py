"""Report schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class ReportCreate(BaseModel):
    dataset_version_id: Optional[UUID] = None
    title: Optional[str] = None
    sections: Optional[List[str]] = None
    persona: str = "analyst"


class ReportExportRequest(BaseModel):
    format: str  # pdf | docx | pptx


class ReportExportResponse(BaseModel):
    export_uri: str


class ReportResponse(BaseModel):
    id: UUID
    project_id: UUID
    dataset_version_id: Optional[UUID] = None
    title: str
    status: str
    content_json: Optional[Dict[str, Any]] = None
    export_uris: Optional[Dict[str, str]] = None
    generated_by: Optional[UUID] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
