"""add sync state table

Revision ID: d4e5f6g7h890
Revises: c3d4e5f6g789
Create Date: 2026-01-23 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h890'
down_revision: Union[str, None] = 'c3d4e5f6g789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('sync_states',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('connector_name', sa.String(length=100), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_full_sync_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sync_states_connector_name'), 'sync_states', ['connector_name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_sync_states_connector_name'), table_name='sync_states')
    op.drop_table('sync_states')
