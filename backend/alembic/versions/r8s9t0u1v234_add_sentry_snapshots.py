"""add sentry_project_snapshots table for historical trend tracking

Revision ID: r8s9t0u1v234
Revises: q7r8s9t0u123
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "r8s9t0u1v234"
down_revision: Union[str, None] = "q7r8s9t0u123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sentry_project_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("events_24h", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("events_7d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("open_issues_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["sentry_projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "snapshot_date", name="uq_sentry_snapshot_project_date"),
    )
    op.create_index(
        op.f("ix_sentry_project_snapshots_project_id"),
        "sentry_project_snapshots",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sentry_project_snapshots_snapshot_date"),
        "sentry_project_snapshots",
        ["snapshot_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_sentry_project_snapshots_snapshot_date"),
        table_name="sentry_project_snapshots",
    )
    op.drop_index(
        op.f("ix_sentry_project_snapshots_project_id"),
        table_name="sentry_project_snapshots",
    )
    op.drop_table("sentry_project_snapshots")
