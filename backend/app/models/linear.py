"""Linear data models."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LinearTeam(Base):
    """Linear team."""

    __tablename__ = "linear_teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    linear_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    key: Mapped[str] = mapped_column(String(50))  # e.g., "ENG"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    issues: Mapped[list["LinearIssue"]] = relationship(back_populates="team")
    workflow_states: Mapped[list["LinearWorkflowState"]] = relationship(
        back_populates="team", order_by="LinearWorkflowState.position"
    )


class LinearWorkflowState(Base):
    """Linear workflow state (e.g. Todo, In Progress, In Review, Done) per team."""

    __tablename__ = "linear_workflow_states"
    __table_args__ = (UniqueConstraint("team_id", "linear_id", name="uq_linear_workflow_state_team_linear_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("linear_teams.id"), index=True)
    linear_id: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(100))  # e.g., "Todo", "In Progress"
    position: Mapped[float] = mapped_column(Float, default=0.0)
    type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # unstarted | started | completed

    team: Mapped["LinearTeam"] = relationship(back_populates="workflow_states")


class LinearIssue(Base):
    """Linear issue."""

    __tablename__ = "linear_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    linear_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("linear_teams.id"))
    identifier: Mapped[str] = mapped_column(String(50), index=True)  # e.g., "ENG-123"
    title: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str] = mapped_column(String(100))  # e.g., "In Progress", "Done"
    priority: Mapped[int] = mapped_column(Integer, default=0)  # 0=none, 1=urgent, 4=low
    assignee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Link to PR for cycle time calculation
    linked_pr_id: Mapped[int | None] = mapped_column(
        ForeignKey("pull_requests.id"), nullable=True
    )

    team: Mapped["LinearTeam"] = relationship(back_populates="issues")
    linked_pr: Mapped["PullRequest | None"] = relationship()  # type: ignore
    state_transitions: Mapped[list["LinearIssueStateTransition"]] = relationship(
        back_populates="issue", order_by="LinearIssueStateTransition.created_at"
    )


class LinearIssueStateTransition(Base):
    """State transition from Linear issue history (for time-in-status)."""

    __tablename__ = "linear_issue_state_transitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    linear_issue_id: Mapped[int] = mapped_column(
        ForeignKey("linear_issues.id", ondelete="CASCADE"), index=True
    )
    from_state: Mapped[str | None] = mapped_column(String(100), nullable=True)  # null = creation
    to_state: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime)

    issue: Mapped["LinearIssue"] = relationship(
        back_populates="state_transitions", foreign_keys=[linear_issue_id]
    )


# Import PullRequest for type hint (avoid circular import at runtime)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.github import PullRequest
