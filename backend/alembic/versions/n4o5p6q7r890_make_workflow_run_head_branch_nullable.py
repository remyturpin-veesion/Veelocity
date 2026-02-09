"""make workflow_run head_branch nullable

Revision ID: n4o5p6q7r890
Revises: m3n4o5p6q789
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n4o5p6q7r890"
down_revision: Union[str, None] = "m3n4o5p6q789"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "workflow_runs",
        "head_branch",
        existing_type=sa.String(255),
        nullable=True,
    )


def downgrade() -> None:
    # Backfill NULLs before making non-nullable again
    op.execute("UPDATE workflow_runs SET head_branch = '' WHERE head_branch IS NULL")
    op.alter_column(
        "workflow_runs",
        "head_branch",
        existing_type=sa.String(255),
        nullable=False,
    )
