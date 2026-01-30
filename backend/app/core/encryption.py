"""Fernet encryption for credentials at rest."""

from app.core.config import settings


def _get_fernet():
    """Return Fernet instance if encryption key is configured."""
    from cryptography.fernet import Fernet

    key = settings.encryption_key
    if not key or not key.strip():
        return None
    try:
        return Fernet(key.strip().encode() if isinstance(key, str) else key)
    except Exception:
        return None


def encrypt(plain: str) -> str | None:
    """
    Encrypt a string. Returns base64 ciphertext or None if encryption unavailable.
    """
    f = _get_fernet()
    if f is None:
        return None
    try:
        return f.encrypt(plain.encode()).decode()
    except Exception:
        return None


def decrypt(cipher: str) -> str | None:
    """
    Decrypt a Fernet ciphertext. Returns plaintext or None on failure.
    """
    f = _get_fernet()
    if f is None:
        return None
    try:
        return f.decrypt(cipher.encode()).decode()
    except Exception:
        return None


def encryption_available() -> bool:
    """Return True if VEELOCITY_ENCRYPTION_KEY is set and valid."""
    return _get_fernet() is not None
