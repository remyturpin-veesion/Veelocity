"""add cursor_api_key_encrypted to app_settings

Revision ID: h8i9j0k1l234
Revises: g7h8i9j0k123
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h8i9j0k1l234"
down_revision: Union[str, None] = "g7h8i9j0k123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column("cursor_api_key_encrypted", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "cursor_api_key_encrypted")
