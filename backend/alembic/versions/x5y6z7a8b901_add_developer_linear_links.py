"""add developer_linear_links table

Revision ID: x5y6z7a8b901
Revises: w3x4y5z6a789
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "x5y6z7a8b901"
down_revision: Union[str, None] = "w3x4y5z6a789"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "developer_linear_links",
        sa.Column("developer_login", sa.String(length=255), nullable=False),
        sa.Column("linear_assignee_name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("developer_login"),
    )


def downgrade() -> None:
    op.drop_table("developer_linear_links")
