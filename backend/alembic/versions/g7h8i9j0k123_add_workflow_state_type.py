"""add workflow state type

Revision ID: g7h8i9j0k123
Revises: 4593294b3e8c
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g7h8i9j0k123"
down_revision: Union[str, None] = "f6g7h8i9j012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "linear_workflow_states",
        sa.Column("type", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("linear_workflow_states", "type")
