"""Auth schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    dob: Optional[str] = None
    role: str
    organization_id: UUID
    organization_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    status: str = "success"
    message: str
    reset_token: Optional[str] = None
    email: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    dob: Optional[str] = None
    organization_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None



