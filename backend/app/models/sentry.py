"""Sentry data stored from periodic sync (projects, issues, event counts)."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SentryProject(Base):
    """Sentry project with event counts and open-issues count. Upserted on each sync."""

    __tablename__ = "sentry_projects"
    __table_args__ = (
        UniqueConstraint(
            "org_slug", "sentry_project_id", name="uq_sentry_project_org_id"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sentry_project_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )
    org_slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(512), default="")
    events_24h: Mapped[int] = mapped_column(Integer, default=0)
    events_7d: Mapped[int] = mapped_column(Integer, default=0)
    open_issues_count: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    issues: Mapped[list["SentryIssue"]] = relationship(
        "SentryIssue",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class SentryIssue(Base):
    """Unresolved Sentry issue for a project. Replaced per project on each sync."""

    __tablename__ = "sentry_issues"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("sentry_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sentry_issue_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    short_id: Mapped[str] = mapped_column(String(32), default="")
    title: Mapped[str] = mapped_column(Text, default="")
    count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[str] = mapped_column(String(64), default="")
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["SentryProject"] = relationship(
        "SentryProject",
        back_populates="issues",
    )
