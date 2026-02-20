#!/usr/bin/env python3
"""
Activate a user by email. Run from backend dir: uv run python scripts/activate_user.py <email>
Uses backend .env / DATABASE_URL.
"""

import asyncio
import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.user import User


async def main(email: str) -> None:
    email = email.strip().lower()
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User not found: {email}", file=sys.stderr)
            sys.exit(1)
        if user.is_active:
            print(f"User already active: {email}")
            return
        user.is_active = True
        await session.commit()
        print(f"Activated: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: uv run python scripts/activate_user.py <email>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
