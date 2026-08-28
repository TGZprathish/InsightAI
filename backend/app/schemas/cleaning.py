"""Cleaning schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class CleaningRule(BaseModel):
    id: str
    type: str  # drop_empty_rows | drop_empty_cols | trim_whitespace | type_coercion | deduplicate | impute_nulls
    column: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    rationale: str
    affected_row_estimate: int


class CleaningApplyRequest(BaseModel):
    approved_rule_ids: List[str]
    edits: Optional[Dict[str, Dict[str, Any]]] = None  # {rule_id: overridden_params}


class CleaningJobResponse(BaseModel):
    id: UUID
    dataset_version_id: UUID
    status: str
    suggested_rules: Optional[List[CleaningRule]] = None
    applied_rules: Optional[List[CleaningRule]] = None
    result_dataset_version_id: Optional[UUID] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
