"""Authentication API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.api.deps import get_current_user, CurrentUser
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/organizations")
async def list_public_organizations():
    """List exact organization type options for user registration."""
    options = [
        "Data Analyist",
        "student",
        "Company Owner",
        "Educator",
        "Finance",
        "Consultant",
        "Researcher",
        "Other",
    ]
    return [{"name": name} for name in options]


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user and organization."""
    clean_email = body.email.strip().lower()
    # Check email uniqueness
    existing = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Find or create organization
    org_name = body.organization_name.strip() if body.organization_name else "General Workspace"
    org_result = await db.execute(select(Organization).where(func.lower(Organization.name) == org_name.lower()))
    org = org_result.scalar_one_or_none()

    if not org:
        org = Organization(name=org_name)
        db.add(org)
        await db.flush()

    # Create user as analyst (standard user)
    user = User(
        organization_id=org.id,
        email=clean_email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="analyst",
    )
    db.add(user)
    await db.flush()

    # Generate tokens
    access_token = create_access_token(user.id, org.id, user.role)
    refresh_token = create_refresh_token(user.id)

    return {
        "user": UserResponse.model_validate(user),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and return JWT tokens and user profile."""
    clean_email = body.email.strip().lower()
    result = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    access_token = create_access_token(user.id, user.organization_id, user.role)
    refresh_token = create_refresh_token(user.id)

    return {
        "user": UserResponse.model_validate(user),
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 900,
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh an access token."""
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        user_id = payload["sub"]
        result = await db.execute(
            select(User).where(User.id == user_id, User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        access_token = create_access_token(user.id, user.organization_id, user.role)
        new_refresh_token = create_refresh_token(user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=900,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Logout and invalidate the refresh token."""
    # In production, add the refresh token to a denylist in Redis
    return None


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current authenticated user's profile."""
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile data (name, email, organization name, password)."""
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 1. Update Full Name
    if body.full_name is not None and body.full_name.strip():
        user.full_name = body.full_name.strip()

    # 2. Update Phone Number
    if body.phone_number is not None:
        user.phone_number = body.phone_number.strip() if body.phone_number else None

    # 3. Update Date of Birth / Age
    if body.dob is not None:
        user.dob = body.dob.strip() if body.dob else None

    # 4. Update Organization Name
    if body.organization_name is not None and body.organization_name.strip():
        org_res = await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
        org = org_res.scalar_one_or_none()
        if org:
            org.name = body.organization_name.strip()

    # 4. Update Password if requested
    if body.new_password is not None and body.new_password.strip():
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password",
            )
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password entered",
            )
        if len(body.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters long",
            )
        user.hashed_password = hash_password(body.new_password)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/me/data", status_code=status.HTTP_200_OK)
async def delete_user_data(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Purge all datasets, projects, reports, conversations, and account data for the authenticated user."""
    from app.models.project import Project
    from app.models.organization import Organization
    from app.models.audit_log import AuditLog

    user_result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Delete all projects belonging to user's organization
    projects_res = await db.execute(
        select(Project).where(Project.organization_id == current_user.organization_id)
    )
    projects = projects_res.scalars().all()
    for proj in projects:
        await db.delete(proj)

    # Delete user record
    await db.delete(user)

    # Delete organization if no remaining users
    org_res = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_res.scalar_one_or_none()
    if org:
        await db.delete(org)

    await db.flush()
    return {
        "status": "success",
        "message": "All authenticated user data and organization records have been permanently purged.",
    }


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a password reset token for the given registered email."""
    email_clean = body.email.strip().lower()
    result = await db.execute(select(User).where(func.lower(User.email) == email_clean))
    user = result.scalar_one_or_none()

    if not user:
        # For security and convenience, provide clear feedback
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account registered with email '{email_clean}'. Please check the email address or create a new account.",
        )

    # Generate a signed password reset token (valid for 30 minutes)
    reset_token = create_password_reset_token(user_id=user.id, email=user.email)

    return ForgotPasswordResponse(
        status="success",
        message=f"Password reset token generated for {user.email}. Please enter your new password to complete the reset.",
        reset_token=reset_token,
        email=user.email,
    )


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset the user's password using the signed password reset token."""
    token = body.token.strip()
    new_password = body.new_password

    if not new_password or len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    try:
        payload = decode_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token. Please request a new reset link.",
        )

    token_type = payload.get("type")
    user_id_str = payload.get("sub")

    if token_type != "password_reset" or not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token.",
        )

    from uuid import UUID
    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed token user identifier.",
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token was not found.",
        )

    # Hash and update new password
    user.hashed_password = hash_password(new_password)
    await db.commit()

    return {
        "status": "success",
        "message": "Your password has been successfully reset! You can now log in with your new credentials.",
    }

