"""UsageQuota model."""

import uuid
from datetime import date

from sqlalchemy import String, BigInteger, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class UsageQuota(Base):
    __tablename__ = "usage_quotas"
    __table_args__ = (
        UniqueConstraint("organization_id", "period_start", "metric", name="uq_usage_quota"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    metric: Mapped[str] = mapped_column(
        String, nullable=False
    )  # datasets_uploaded | storage_bytes | ai_tokens | reports_generated
    limit_value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    used_value: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Relationships
    organization = relationship("Organization", back_populates="usage_quotas")
