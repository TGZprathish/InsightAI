"""TableSchema model."""

import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TableSchema(Base):
    __tablename__ = "table_schemas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dataset_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False
    )
    table_name: Mapped[str] = mapped_column(String, nullable=False, default="main")

    # Relationships
    dataset_version = relationship("DatasetVersion", back_populates="table_schemas")
    columns = relationship("ColumnSchema", back_populates="table_schema", cascade="all, delete-orphan")
