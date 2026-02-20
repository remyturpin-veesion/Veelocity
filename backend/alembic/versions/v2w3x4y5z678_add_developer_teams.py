"""add developer_teams table for persistent teams shared by all users

Revision ID: v2w3x4y5z678
Revises: u1v2w3x4y567
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v2w3x4y5z678"
down_revision: Union[str, None] = "u1v2w3x4y567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "developer_teams",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("members", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("developer_teams")
