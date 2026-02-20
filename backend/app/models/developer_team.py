"""Developer team model: named groups of GitHub logins, shared across all users."""

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeveloperTeam(Base):
    """A named team of developers (GitHub logins). Stored globally for all users."""

    __tablename__ = "developer_teams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    members: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
