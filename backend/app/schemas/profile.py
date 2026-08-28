"""Profile schemas."""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel


class ProfileResponse(BaseModel):
    id: UUID
    dataset_version_id: UUID
    status: str
    summary: Optional[Dict[str, Any]] = None
    column_profiles: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
