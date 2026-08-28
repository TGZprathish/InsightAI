"""Dataset schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class DatasetVersionResponse(BaseModel):
    id: UUID
    dataset_id: UUID
    version_number: int
    storage_uri: str
    file_checksum: str
    stage: str
    row_count: Optional[int] = None
    byte_size: Optional[int] = None
    parent_version_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DatasetResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    source_type: str
    created_by: UUID
    created_at: datetime
    deleted_at: Optional[datetime] = None
    latest_version: Optional[DatasetVersionResponse] = None
    version: Optional[int] = 1
    stage: Optional[str] = "raw"
    rows: Optional[int] = None
    versions_count: Optional[int] = 1

    model_config = {"from_attributes": True}


class DatasetUploadResponse(BaseModel):
    dataset: DatasetResponse
    version: DatasetVersionResponse


class ColumnSchemaResponse(BaseModel):
    name: str
    ordinal_position: int
    inferred_type: str
    is_pii_suspect: bool


class DataPreviewResponse(BaseModel):
    columns: List[ColumnSchemaResponse]
    rows: List[Dict[str, Any]]
    total_rows: int
    sampled: bool
    version_number: Optional[int] = 1
    stage: Optional[str] = "raw"
    dataset_name: Optional[str] = None


class CleanRuleInput(BaseModel):
    id: Optional[str] = None
    type: Optional[str] = "trim_whitespace"
    column: Optional[str] = None
    rationale: Optional[str] = None


class CleanDatasetRequest(BaseModel):
    rules: Optional[List[CleanRuleInput]] = None
    rule_ids: Optional[List[str]] = None


class CleanDatasetResponse(BaseModel):
    message: str
    cleaned_version_id: UUID
    version_number: int
    cleaned_row_count: int
    applied_rules_count: int

