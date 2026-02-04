"""Cursor data stored from API sync (team, spend, daily usage, DAU)."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CursorTeamMember(Base):
    """Team members from Cursor Admin API. Replaced on each sync."""

    __tablename__ = "cursor_team_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CursorSpendSnapshot(Base):
    """Latest spend snapshot (current billing cycle). One row per sync; query latest."""

    __tablename__ = "cursor_spend_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    total_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_members: Mapped[int | None] = mapped_column(Integer, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CursorDailyUsage(Base):
    """Aggregated daily usage by date. Upserted by date on sync."""

    __tablename__ = "cursor_daily_usage"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    lines_added: Mapped[int] = mapped_column(Integer, default=0)
    lines_deleted: Mapped[int] = mapped_column(Integer, default=0)
    accepted_lines_added: Mapped[int] = mapped_column(Integer, default=0)
    accepted_lines_deleted: Mapped[int] = mapped_column(Integer, default=0)
    composer_requests: Mapped[int] = mapped_column(Integer, default=0)
    chat_requests: Mapped[int] = mapped_column(Integer, default=0)
    agent_requests: Mapped[int] = mapped_column(Integer, default=0)
    tabs_shown: Mapped[int] = mapped_column(Integer, default=0)
    tabs_accepted: Mapped[int] = mapped_column(Integer, default=0)
    applies: Mapped[int] = mapped_column(Integer, default=0)
    accepts: Mapped[int] = mapped_column(Integer, default=0)
    rejects: Mapped[int] = mapped_column(Integer, default=0)
    cmdk_usages: Mapped[int] = mapped_column(Integer, default=0)
    bugbot_usages: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CursorDau(Base):
    """Daily active users by date (Enterprise). Upserted by date on sync."""

    __tablename__ = "cursor_dau"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    dau_count: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
