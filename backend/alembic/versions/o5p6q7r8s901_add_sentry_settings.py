"""add sentry_api_token and sentry base url, org, project to app_settings

Revision ID: o5p6q7r8s901
Revises: n4o5p6q7r890
Create Date: 2026-02-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o5p6q7r8s901"
down_revision: Union[str, None] = "n4o5p6q7r890"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column("sentry_api_token_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "app_settings",
        sa.Column("sentry_base_url", sa.String(500), server_default="https://sentry.tooling.veesion.io", nullable=False),
    )
    op.add_column(
        "app_settings",
        sa.Column("sentry_org", sa.String(255), server_default="", nullable=False),
    )
    op.add_column(
        "app_settings",
        sa.Column("sentry_project", sa.String(255), server_default="", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "sentry_project")
    op.drop_column("app_settings", "sentry_org")
    op.drop_column("app_settings", "sentry_base_url")
    op.drop_column("app_settings", "sentry_api_token_encrypted")
