"""add last_login_at to users

Revision ID: w3x4y5z6a789
Revises: v2w3x4y5z678
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "w3x4y5z6a789"
down_revision: Union[str, None] = "v2w3x4y5z678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
