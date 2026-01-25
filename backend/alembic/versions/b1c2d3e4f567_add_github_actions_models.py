"""add github actions models

Revision ID: b1c2d3e4f567
Revises: acd5ad9b6546
Create Date: 2026-01-23 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f567'
down_revision: Union[str, None] = 'acd5ad9b6546'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create workflows table
    op.create_table('workflows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('github_id', sa.BigInteger(), nullable=False),
        sa.Column('repo_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('path', sa.String(length=512), nullable=False),
        sa.Column('state', sa.String(length=50), nullable=False),
        sa.Column('is_deployment', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['repo_id'], ['repositories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflows_github_id'), 'workflows', ['github_id'], unique=True)

    # Create workflow_runs table
    op.create_table('workflow_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('github_id', sa.BigInteger(), nullable=False),
        sa.Column('workflow_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('conclusion', sa.String(length=50), nullable=True),
        sa.Column('run_number', sa.Integer(), nullable=False),
        sa.Column('head_sha', sa.String(length=40), nullable=False),
        sa.Column('head_branch', sa.String(length=255), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_runs_github_id'), 'workflow_runs', ['github_id'], unique=True)
    op.create_index(op.f('ix_workflow_runs_head_sha'), 'workflow_runs', ['head_sha'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_workflow_runs_head_sha'), table_name='workflow_runs')
    op.drop_index(op.f('ix_workflow_runs_github_id'), table_name='workflow_runs')
    op.drop_table('workflow_runs')
    op.drop_index(op.f('ix_workflows_github_id'), table_name='workflows')
    op.drop_table('workflows')
