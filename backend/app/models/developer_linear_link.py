"""Developer to Linear assignee mapping."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeveloperLinearLink(Base):
    """Maps a developer (GitHub login) to a Linear assignee name."""

    __tablename__ = "developer_linear_links"

    developer_login: Mapped[str] = mapped_column(String(255), primary_key=True)
    linear_assignee_name: Mapped[str] = mapped_column(String(255), nullable=False)
