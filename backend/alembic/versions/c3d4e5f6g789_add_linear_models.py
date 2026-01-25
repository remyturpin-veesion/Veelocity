"""add linear models

Revision ID: c3d4e5f6g789
Revises: b1c2d3e4f567
Create Date: 2026-01-23 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g789'
down_revision: Union[str, None] = 'b1c2d3e4f567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create linear_teams table
    op.create_table('linear_teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('linear_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('key', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_linear_teams_linear_id'), 'linear_teams', ['linear_id'], unique=True)

    # Create linear_issues table
    op.create_table('linear_issues',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('linear_id', sa.String(length=50), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('identifier', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=1024), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('assignee_name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.Column('linked_pr_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['linear_teams.id'], ),
        sa.ForeignKeyConstraint(['linked_pr_id'], ['pull_requests.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_linear_issues_linear_id'), 'linear_issues', ['linear_id'], unique=True)
    op.create_index(op.f('ix_linear_issues_identifier'), 'linear_issues', ['identifier'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_linear_issues_identifier'), table_name='linear_issues')
    op.drop_index(op.f('ix_linear_issues_linear_id'), table_name='linear_issues')
    op.drop_table('linear_issues')
    op.drop_index(op.f('ix_linear_teams_linear_id'), table_name='linear_teams')
    op.drop_table('linear_teams')
