"""add linear workflow states

Revision ID: f6g7h8i9j012
Revises: e5f6g7h8i901
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6g7h8i9j012"
down_revision: Union[str, None] = "e5f6g7h8i901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "linear_workflow_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("linear_id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("position", sa.Float(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["team_id"], ["linear_teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "linear_id", name="uq_linear_workflow_state_team_linear_id"),
    )
    op.create_index(
        op.f("ix_linear_workflow_states_team_id"),
        "linear_workflow_states",
        ["team_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_linear_workflow_states_linear_id"),
        "linear_workflow_states",
        ["linear_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_linear_workflow_states_linear_id"),
        table_name="linear_workflow_states",
    )
    op.drop_index(
        op.f("ix_linear_workflow_states_team_id"),
        table_name="linear_workflow_states",
    )
    op.drop_table("linear_workflow_states")
