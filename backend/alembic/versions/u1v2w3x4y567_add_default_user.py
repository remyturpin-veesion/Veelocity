"""add default user remy.turpin@veesion.com

Revision ID: u1v2w3x4y567
Revises: t0u1v2w3x456
Create Date: 2026-02-20

Inserts the default user for initial deploy. Default password: ChangeMe123!
Change it after first login via User management or a future "change password" flow.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "u1v2w3x4y567"
down_revision: Union[str, None] = "t0u1v2w3x456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Hash for password "ChangeMe123!" (SHA-256 + bcrypt, same as app)
DEFAULT_PASSWORD_HASH = "$2b$12$8LHJ2nfq.Ts.FyJt1e8g1.QAfJB/ctonwELBASqD8CD34NaFziPT2"
DEFAULT_EMAIL = "remy.turpin@veesion.com"


def upgrade() -> None:
    # Only insert if no user with this email exists (idempotent for re-runs)
    conn = op.get_bind()
    stmt = sa.text(
        """
        INSERT INTO users (email, password_hash, is_active, created_at)
        SELECT :email, :password_hash, true, NOW()
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = :email)
        """
    ).bindparams(email=DEFAULT_EMAIL, password_hash=DEFAULT_PASSWORD_HASH)
    conn.execute(stmt)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM users WHERE email = :email").bindparams(email=DEFAULT_EMAIL))
