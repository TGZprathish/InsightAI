"""AI Chat schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class ConversationCreate(BaseModel):
    dataset_id: Optional[UUID] = None
    title: Optional[str] = None
    mode: str = "chat"  # chat | detective | bi_briefing
    persona: str = "analyst"  # executive | analyst | technical


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    tool_trace: Optional[Dict[str, Any]] = None
    token_usage: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: UUID
    project_id: Optional[UUID] = None
    dataset_id: Optional[UUID] = None
    title: Optional[str] = None
    mode: str = "chat"
    persona: str = "analyst"
    created_by: Optional[UUID] = None
    created_at: datetime
    messages: Optional[List[MessageResponse]] = None

    model_config = {"from_attributes": True}


class ConversationListItem(BaseModel):
    id: UUID
    dataset_id: Optional[UUID] = None
    dataset_name: Optional[str] = None
    persona: str
    mode: str
    message_count: int
    last_message_preview: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class DatasetChatRequest(BaseModel):
    dataset_id: UUID
    prompt: str
    conversation_id: Optional[UUID] = None
    persona: Optional[str] = "analyst"  # executive | analyst | technical
    mode: Optional[str] = "chat"  # chat | detective | bi_briefing
    api_key: Optional[str] = None
    model: Optional[str] = None


class AiConfigResponse(BaseModel):
    provider: str
    model: str
    has_api_key: bool
    masked_key: str
    mock_mode: bool
    status: str


class AiKeyTestRequest(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None


class AiKeyTestResponse(BaseModel):
    success: bool
    provider: str
    model: str
    message: Optional[str] = None
    error: Optional[str] = None
