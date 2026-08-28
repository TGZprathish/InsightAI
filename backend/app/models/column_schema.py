"""ColumnSchema model."""

import uuid
from sqlalchemy import String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ColumnSchema(Base):
    __tablename__ = "column_schemas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    table_schema_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("table_schemas.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    ordinal_position: Mapped[int] = mapped_column(Integer, nullable=False)
    inferred_type: Mapped[str] = mapped_column(
        String, nullable=False
    )  # integer | float | string | boolean | datetime | categorical
    is_pii_suspect: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    table_schema = relationship("TableSchema", back_populates="columns")
