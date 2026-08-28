"""CleaningJob model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CleaningJob(Base):
    __tablename__ = "cleaning_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dataset_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String, nullable=False, default="pending"
    )  # pending | suggested | applied | failed
    suggested_rules: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    applied_rules: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    result_dataset_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id"), nullable=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    dataset_version = relationship(
        "DatasetVersion",
        back_populates="cleaning_jobs",
        foreign_keys=[dataset_version_id],
    )
    result_version = relationship(
        "DatasetVersion",
        foreign_keys=[result_dataset_version_id],
    )
