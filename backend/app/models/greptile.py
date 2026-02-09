"""Greptile indexed repositories stored from API sync."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GreptileRepository(Base):
    """Indexed repository from Greptile API. Upserted by greptile_repo_id on sync."""

    __tablename__ = "greptile_repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    greptile_repo_id: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    repository: Mapped[str] = mapped_column(
        String(512), default=""
    )  # full_name owner/repo
    remote: Mapped[str] = mapped_column(String(255), default="")
    branch: Mapped[str] = mapped_column(String(255), default="")
    private: Mapped[bool | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(100), default="")
    files_processed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_files: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha: Mapped[str | None] = mapped_column(String(255), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
