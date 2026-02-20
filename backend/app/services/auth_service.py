"""User registration and authentication."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Load a user by primary key."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Load a user by email (case-insensitive)."""
    result = await db.execute(select(User).where(User.email == email.strip().lower()))
    return result.scalar_one_or_none()


async def count_users(db: AsyncSession) -> int:
    """Return total number of users (for first-user auto-activation)."""
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar() or 0


async def register_user(db: AsyncSession, email: str, password: str) -> User:
    """Create a new user. Raises ValueError if email already exists. First user is auto-activated."""
    email_normalized = email.strip().lower()
    existing = await get_user_by_email(db, email_normalized)
    if existing:
        raise ValueError("A user with this email already exists")
    n = await count_users(db)
    user = User(
        email=email_normalized,
        password_hash=hash_password(password),
        is_active=(n == 0),  # First user is active so they can activate others
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def create_user(
    db: AsyncSession, email: str, password: str, is_active: bool
) -> User:
    """Create a new user (admin). Raises ValueError if email already exists."""
    email_normalized = email.strip().lower()
    existing = await get_user_by_email(db, email_normalized)
    if existing:
        raise ValueError("A user with this email already exists")
    user = User(
        email=email_normalized,
        password_hash=hash_password(password),
        is_active=is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    """Verify credentials and return the user, or None if invalid. Does not check is_active."""
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def list_users(db: AsyncSession) -> list[User]:
    """List all users (for management)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def record_last_login(db: AsyncSession, user_id: int) -> None:
    """Set last_login_at to now for the given user (e.g. on successful login)."""
    from datetime import datetime

    user = await get_user_by_id(db, user_id)
    if user is None:
        return
    user.last_login_at = datetime.utcnow()
    await db.commit()


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """Hard-delete a user by id. Returns True if deleted, False if not found."""
    user = await get_user_by_id(db, user_id)
    if user is None:
        return False
    await db.delete(user)
    await db.commit()
    return True


async def set_user_active(
    db: AsyncSession, user_id: int, is_active: bool
) -> User | None:
    """Set is_active for a user. Returns the user or None if not found."""
    user = await get_user_by_id(db, user_id)
    if user is None:
        return None
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(
    db: AsyncSession, user_id: int, current_password: str, new_password: str
) -> User | None:
    """
    Update password for the given user. Verifies current password first.
    Returns the user on success, None if user not found or current password wrong.
    """
    user = await get_user_by_id(db, user_id)
    if user is None:
        return None
    if not verify_password(current_password, user.password_hash):
        return None
    user.password_hash = hash_password(new_password)
    await db.commit()
    await db.refresh(user)
    return user
