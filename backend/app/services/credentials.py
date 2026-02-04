"""Load and store credentials from DB (encrypted). No env fallback."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt, encrypt, encryption_available
from app.models.app_settings import AppSettings

SINGLETON_ID = 1


@dataclass
class ResolvedCredentials:
    """Credentials read from the database (decrypted)."""

    github_token: str | None
    github_repos: str
    linear_api_key: str | None
    linear_workspace_name: str
    cursor_api_key: str | None


class CredentialsService:
    """Load credentials from DB (decrypted); persist encrypted to DB."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_credentials(self) -> ResolvedCredentials:
        """
        Return current credentials from the database only.
        GitHub and Linear tokens/repos are not read from environment variables.
        """
        result = await self._db.execute(
            select(AppSettings).where(AppSettings.id == SINGLETON_ID)
        )
        row = result.scalar_one_or_none()
        github_token: str | None = None
        github_repos = ""
        linear_api_key: str | None = None
        linear_workspace_name = ""
        cursor_api_key: str | None = None
        if row:
            if row.github_token_encrypted:
                dec = decrypt(row.github_token_encrypted)
                if dec:
                    github_token = dec
            github_repos = (row.github_repos or "").strip()
            if row.linear_api_key_encrypted:
                dec = decrypt(row.linear_api_key_encrypted)
                if dec:
                    linear_api_key = dec
            linear_workspace_name = (row.linear_workspace_name or "").strip()
            if row.cursor_api_key_encrypted:
                dec = decrypt(row.cursor_api_key_encrypted)
                if dec:
                    cursor_api_key = dec
        return ResolvedCredentials(
            github_token=github_token,
            github_repos=github_repos,
            linear_api_key=linear_api_key,
            linear_workspace_name=linear_workspace_name,
            cursor_api_key=cursor_api_key,
        )

    async def set_credentials(
        self,
        *,
        github_token: str | None = None,
        github_repos: str | None = None,
        linear_api_key: str | None = None,
        linear_workspace_name: str | None = None,
        cursor_api_key: str | None = None,
    ) -> None:
        """
        Update stored credentials. Encrypts secrets. Omit a field to leave unchanged.
        Raises ValueError if encryption unavailable and a secret is provided.
        """
        if not encryption_available():
            if github_token or linear_api_key or cursor_api_key:
                raise ValueError(
                    "VEELOCITY_ENCRYPTION_KEY is not set; cannot store credentials in DB"
                )
        result = await self._db.execute(
            select(AppSettings).where(AppSettings.id == SINGLETON_ID)
        )
        row = result.scalar_one_or_none()
        if not row:
            row = AppSettings(
                id=SINGLETON_ID,
                github_repos="",
                linear_workspace_name="",
            )
            self._db.add(row)
        if github_token is not None:
            row.github_token_encrypted = encrypt(github_token) if github_token else None
        if github_repos is not None:
            row.github_repos = github_repos
        if linear_api_key is not None:
            row.linear_api_key_encrypted = (
                encrypt(linear_api_key) if linear_api_key else None
            )
        if linear_workspace_name is not None:
            row.linear_workspace_name = linear_workspace_name
        if cursor_api_key is not None:
            row.cursor_api_key_encrypted = (
                encrypt(cursor_api_key) if cursor_api_key else None
            )
        await self._db.commit()
        await self._db.refresh(row)

    async def clear_github_token(self) -> None:
        """Remove the stored GitHub token (e.g. on disconnect)."""
        result = await self._db.execute(
            select(AppSettings).where(AppSettings.id == SINGLETON_ID)
        )
        row = result.scalar_one_or_none()
        if row:
            row.github_token_encrypted = None
            await self._db.commit()
            await self._db.refresh(row)

    async def clear_cursor_api_key(self) -> None:
        """Remove the stored Cursor API key (e.g. on disconnect)."""
        result = await self._db.execute(
            select(AppSettings).where(AppSettings.id == SINGLETON_ID)
        )
        row = result.scalar_one_or_none()
        if row:
            row.cursor_api_key_encrypted = None
            await self._db.commit()
            await self._db.refresh(row)

    async def get_masked(self) -> dict:
        """
        Return public/masked state for API: no raw secrets.
        github_configured = token + repos both set; github_has_token = token only (e.g. after OAuth).
        """
        creds = await self.get_credentials()
        has_repos = bool((creds.github_repos or "").strip())
        has_token = bool(creds.github_token)
        return {
            "github_configured": has_token and has_repos,
            "github_has_token": has_token,
            "github_repos": creds.github_repos or "",
            "linear_configured": bool(creds.linear_api_key),
            "linear_workspace_name": creds.linear_workspace_name or "",
            "cursor_configured": bool(creds.cursor_api_key),
            "storage_available": encryption_available(),
        }
