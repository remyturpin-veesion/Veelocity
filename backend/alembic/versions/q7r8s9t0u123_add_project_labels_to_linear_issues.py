"""add project_name and labels to linear_issues

Revision ID: q7r8s9t0u123
Revises: p6q7r8s9t012
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "q7r8s9t0u123"
down_revision: Union[str, None] = "p6q7r8s9t012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("linear_issues", sa.Column("project_name", sa.String(255), nullable=True))
    op.add_column("linear_issues", sa.Column("labels", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("linear_issues", "labels")
    op.drop_column("linear_issues", "project_name")
