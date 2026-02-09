"""widen github_repos column to text for org subscriptions

Revision ID: m3n4o5p6q789
Revises: l2m3n4o5p678
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "m3n4o5p6q789"
down_revision: Union[str, None] = "l2m3n4o5p678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "app_settings",
        "github_repos",
        existing_type=sa.String(length=2000),
        type_=sa.Text(),
        existing_nullable=False,
        existing_server_default="",
    )


def downgrade() -> None:
    op.alter_column(
        "app_settings",
        "github_repos",
        existing_type=sa.Text(),
        type_=sa.String(length=2000),
        existing_nullable=False,
        existing_server_default="",
    )
