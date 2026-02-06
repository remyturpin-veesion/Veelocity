"""add linear issue state transitions

Revision ID: k1l2m3n4o567
Revises: 80f635ea2232
Create Date: 2026-02-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k1l2m3n4o567"
down_revision: Union[str, None] = "80f635ea2232"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "linear_issue_state_transitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("linear_issue_id", sa.Integer(), nullable=False),
        sa.Column("from_state", sa.String(length=100), nullable=True),
        sa.Column("to_state", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["linear_issue_id"],
            ["linear_issues.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_linear_issue_state_transitions_linear_issue_id"),
        "linear_issue_state_transitions",
        ["linear_issue_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_linear_issue_state_transitions_linear_issue_id"),
        table_name="linear_issue_state_transitions",
    )
    op.drop_table("linear_issue_state_transitions")
