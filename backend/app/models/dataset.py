"""Dataset model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(
        String, nullable=False
    )  # csv | xlsx | json | db_connection
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project = relationship("Project", back_populates="datasets")
    created_by_user = relationship("User", back_populates="datasets_created")
    versions = relationship("DatasetVersion", back_populates="dataset", cascade="all, delete-orphan")
    ai_conversations = relationship("AiConversation", back_populates="dataset")
    embeddings = relationship("Embedding", back_populates="dataset", cascade="all, delete-orphan")

    @property
    def latest_version(self):
        try:
            if not self.versions:
                return None
            return sorted(self.versions, key=lambda v: v.version_number or 0, reverse=True)[0]
        except Exception:
            return None

