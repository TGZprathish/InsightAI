"""ML model schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class MLModelCreate(BaseModel):
    model_type: str  # linear_regression | logistic_regression | random_forest | kmeans | xgboost
    target_column: Optional[str] = None
    feature_columns: Optional[List[str]] = None
    params: Optional[Dict[str, Any]] = None


class MLModelResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    model_type: str
    target_column: Optional[str] = None
    feature_columns: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    artifact_uri: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PredictRequest(BaseModel):
    rows: List[Dict[str, Any]]


class PredictResponse(BaseModel):
    predictions: List[Any]
