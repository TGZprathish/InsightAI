"""Project schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    created_by: UUID
    created_at: datetime
    archived_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
