"""Password hashing and JWT token handling."""

import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# Pre-hash with SHA-256 so bcrypt never sees >72 bytes; allows arbitrary password length.
def _sha256_digest(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(plain_password: str) -> str:
    """Hash a plain password: SHA-256 then bcrypt (no 72-byte limit)."""
    digest = _sha256_digest(plain_password)  # 32 bytes
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(digest, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password: SHA-256 then bcrypt (same as hash_password)."""
    digest = _sha256_digest(plain_password)
    return bcrypt.checkpw(digest, hashed_password.encode("utf-8"))


def create_access_token(
    subject: str | int, expires_delta: timedelta | None = None
) -> str:
    """Create a JWT access token. Subject is typically the user id."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode: dict[str, Any] = {"sub": str(subject), "exp": expire}
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> str | None:
    """Decode and validate a JWT; return the subject (user id) or None if invalid."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        sub = payload.get("sub")
        return str(sub) if sub is not None else None
    except JWTError:
        return None
