"""add cursor and greptile storage tables

Revision ID: j0k1l2m3n456
Revises: i9j0k1l2m345
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j0k1l2m3n456"
down_revision: Union[str, None] = "i9j0k1l2m345"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cursor_team_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cursor_team_members_email"),
        "cursor_team_members",
        ["email"],
        unique=False,
    )

    op.create_table(
        "cursor_spend_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_members", sa.Integer(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "cursor_daily_usage",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("lines_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lines_deleted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accepted_lines_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accepted_lines_deleted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("composer_requests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chat_requests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("agent_requests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tabs_shown", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tabs_accepted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("applies", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accepts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejects", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cmdk_usages", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bugbot_usages", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("date"),
    )

    op.create_table(
        "cursor_dau",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("dau_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("date"),
    )

    op.create_table(
        "greptile_repositories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("greptile_repo_id", sa.String(length=512), nullable=False),
        sa.Column("repository", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("remote", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("branch", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("private", sa.Boolean(), nullable=True),
        sa.Column("status", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("files_processed", sa.Integer(), nullable=True),
        sa.Column("num_files", sa.Integer(), nullable=True),
        sa.Column("sha", sa.String(length=255), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_greptile_repositories_greptile_repo_id"),
        "greptile_repositories",
        ["greptile_repo_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_greptile_repositories_greptile_repo_id"),
        table_name="greptile_repositories",
    )
    op.drop_table("greptile_repositories")
    op.drop_table("cursor_dau")
    op.drop_table("cursor_daily_usage")
    op.drop_table("cursor_spend_snapshots")
    op.drop_index(
        op.f("ix_cursor_team_members_email"),
        table_name="cursor_team_members",
    )
    op.drop_table("cursor_team_members")
