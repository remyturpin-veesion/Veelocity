"""add app_settings table

Revision ID: e5f6g7h8i901
Revises: d4e5f6g7h890
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6g7h8i901"
down_revision: Union[str, None] = "4593294b3e8c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("github_token_encrypted", sa.Text(), nullable=True),
        sa.Column("github_repos", sa.String(length=2000), nullable=False, server_default=""),
        sa.Column("linear_api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("linear_workspace_name", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("INSERT INTO app_settings (id, github_repos, linear_workspace_name) VALUES (1, '', '')")


def downgrade() -> None:
    op.drop_table("app_settings")
