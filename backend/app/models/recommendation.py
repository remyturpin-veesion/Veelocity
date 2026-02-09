"""Stored recommendation runs from the scheduler."""

from datetime import datetime

from sqlalchemy import DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationRun(Base):
    """
    Stores the latest proposed recommendations from the scheduler.
    One row per run; we keep only the most recent (scheduler overwrites or we prune).
    """

    __tablename__ = "recommendation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    repo_ids: Mapped[list | None] = mapped_column(
        JSONB, nullable=True
    )  # list of int or None for all
    recommendations: Mapped[list] = mapped_column(
        JSONB, nullable=False
    )  # list of recommendation dicts
