"""App settings model for encrypted credentials (singleton row)."""

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AppSettings(Base):
    """Stores encrypted GitHub and Linear credentials (single row)."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_repos: Mapped[str] = mapped_column(String(2000), default="")
    linear_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    linear_workspace_name: Mapped[str] = mapped_column(String(500), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
