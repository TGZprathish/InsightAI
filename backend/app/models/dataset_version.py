"""DatasetVersion model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (
        UniqueConstraint("dataset_id", "version_number", name="uq_dataset_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_uri: Mapped[str] = mapped_column(String, nullable=False)
    file_checksum: Mapped[str] = mapped_column(String, nullable=False)
    stage: Mapped[str] = mapped_column(
        String, nullable=False, default="raw"
    )  # raw | cleaned
    row_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    byte_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    parent_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    dataset = relationship("Dataset", back_populates="versions")
    parent_version = relationship("DatasetVersion", remote_side="DatasetVersion.id")
    table_schemas = relationship("TableSchema", back_populates="dataset_version", cascade="all, delete-orphan")
    profiles = relationship("Profile", back_populates="dataset_version", cascade="all, delete-orphan")
    cleaning_jobs = relationship("CleaningJob", back_populates="dataset_version", foreign_keys="CleaningJob.dataset_version_id")
    analyses = relationship("Analysis", back_populates="dataset_version", cascade="all, delete-orphan")
