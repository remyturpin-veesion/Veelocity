"""add greptile_api_key_encrypted to app_settings

Revision ID: i9j0k1l2m345
Revises: h8i9j0k1l234
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i9j0k1l2m345"
down_revision: Union[str, None] = "h8i9j0k1l234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column("greptile_api_key_encrypted", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "greptile_api_key_encrypted")
