"""DashboardWidget model."""

import uuid
from typing import Optional

from sqlalchemy import String, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False
    )
    widget_type: Mapped[str] = mapped_column(
        String, nullable=False
    )  # kpi_card | line_chart | bar_chart | table | pie_chart
    analysis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id"), nullable=True
    )
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    position: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {x, y, w, h}

    # Relationships
    dashboard = relationship("Dashboard", back_populates="widgets")
    analysis = relationship("Analysis")
