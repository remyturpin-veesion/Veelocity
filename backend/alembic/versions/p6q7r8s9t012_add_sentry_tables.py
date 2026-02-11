"""add sentry_projects and sentry_issues tables

Revision ID: p6q7r8s9t012
Revises: o5p6q7r8s901
Create Date: 2026-02-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "p6q7r8s9t012"
down_revision: Union[str, None] = "o5p6q7r8s901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sentry_projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sentry_project_id", sa.String(length=64), nullable=False),
        sa.Column("org_slug", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("events_24h", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("events_7d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("open_issues_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_slug", "sentry_project_id", name="uq_sentry_project_org_id"),
    )
    op.create_index(
        op.f("ix_sentry_projects_org_slug"),
        "sentry_projects",
        ["org_slug"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sentry_projects_sentry_project_id"),
        "sentry_projects",
        ["sentry_project_id"],
        unique=False,
    )

    op.create_table(
        "sentry_issues",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("sentry_issue_id", sa.String(length=64), nullable=False),
        sa.Column("short_id", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("title", sa.Text(), nullable=False, server_default=""),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_seen", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["sentry_projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_sentry_issues_project_id"),
        "sentry_issues",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sentry_issues_sentry_issue_id"),
        "sentry_issues",
        ["sentry_issue_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_sentry_issues_sentry_issue_id"),
        table_name="sentry_issues",
    )
    op.drop_index(
        op.f("ix_sentry_issues_project_id"),
        table_name="sentry_issues",
    )
    op.drop_table("sentry_issues")
    op.drop_index(
        op.f("ix_sentry_projects_sentry_project_id"),
        table_name="sentry_projects",
    )
    op.drop_index(
        op.f("ix_sentry_projects_org_slug"),
        table_name="sentry_projects",
    )
    op.drop_table("sentry_projects")
