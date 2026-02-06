"""add url to linear issues

Revision ID: l2m3n4o5p678
Revises: k1l2m3n4o567
Create Date: 2026-02-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l2m3n4o5p678"
down_revision: Union[str, None] = "k1l2m3n4o567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "linear_issues",
        sa.Column("url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("linear_issues", "url")
