from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(512), unique=True)
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pull_requests: Mapped[list["PullRequest"]] = relationship(back_populates="repository")
    commits: Mapped[list["Commit"]] = relationship(back_populates="repository")
    workflows: Mapped[list["Workflow"]] = relationship(back_populates="repository")


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(1024))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str] = mapped_column(String(50))
    draft: Mapped[bool] = mapped_column(Boolean, default=False)
    author_login: Mapped[str] = mapped_column(String(255))
    author_avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    merged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    additions: Mapped[int] = mapped_column(Integer, default=0)
    deletions: Mapped[int] = mapped_column(Integer, default=0)
    commits_count: Mapped[int] = mapped_column(Integer, default=0)

    repository: Mapped["Repository"] = relationship(back_populates="pull_requests")
    reviews: Mapped[list["PRReview"]] = relationship(back_populates="pull_request")
    comments: Mapped[list["PRComment"]] = relationship(back_populates="pull_request")
    commits_rel: Mapped[list["Commit"]] = relationship(back_populates="pull_request")


class PRReview(Base):
    __tablename__ = "pr_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    pr_id: Mapped[int] = mapped_column(ForeignKey("pull_requests.id"))
    reviewer_login: Mapped[str] = mapped_column(String(255))
    state: Mapped[str] = mapped_column(String(50))
    submitted_at: Mapped[datetime] = mapped_column(DateTime)

    pull_request: Mapped["PullRequest"] = relationship(back_populates="reviews")


class PRComment(Base):
    __tablename__ = "pr_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    pr_id: Mapped[int] = mapped_column(ForeignKey("pull_requests.id"))
    author_login: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    pull_request: Mapped["PullRequest"] = relationship(back_populates="comments")


class Commit(Base):
    __tablename__ = "commits"

    id: Mapped[int] = mapped_column(primary_key=True)
    sha: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
    pr_id: Mapped[int | None] = mapped_column(ForeignKey("pull_requests.id"), nullable=True)
    author_login: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    committed_at: Mapped[datetime] = mapped_column(DateTime)

    repository: Mapped["Repository"] = relationship(back_populates="commits")
    pull_request: Mapped["PullRequest | None"] = relationship(back_populates="commits_rel")


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(512))
    state: Mapped[str] = mapped_column(String(50))  # active, disabled, etc.
    is_deployment: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository: Mapped["Repository"] = relationship(back_populates="workflows")
    runs: Mapped[list["WorkflowRun"]] = relationship(back_populates="workflow")


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"))
    status: Mapped[str] = mapped_column(String(50))  # queued, in_progress, completed
    conclusion: Mapped[str | None] = mapped_column(String(50), nullable=True)  # success, failure, cancelled
    run_number: Mapped[int] = mapped_column(Integer)
    head_sha: Mapped[str] = mapped_column(String(40), index=True)
    head_branch: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workflow: Mapped["Workflow"] = relationship(back_populates="runs")
