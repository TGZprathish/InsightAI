"""Analysis schemas."""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel


class AnalysisCreate(BaseModel):
    analysis_type: str  # descriptive_stats | correlation | trend | segment_compare
    params: Optional[Dict[str, Any]] = None


class AnalysisResponse(BaseModel):
    id: UUID
    dataset_version_id: UUID
    analysis_type: str
    params: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    status: str
    created_by: Optional[UUID] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
