"""Usage & quota schemas."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class UsageResponse(BaseModel):
    metric: str
    limit_value: int
    used_value: int
    period_start: date
    period_end: date


class UsageHistoryPoint(BaseModel):
    date: date
    value: int


class UsageHistoryResponse(BaseModel):
    metric: str
    history: List[UsageHistoryPoint]
