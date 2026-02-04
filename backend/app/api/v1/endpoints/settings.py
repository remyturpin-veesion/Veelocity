from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import encryption_available
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.services.credentials import CredentialsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Get public/masked settings. Never returns API keys or tokens."""
    service = CredentialsService(db)
    masked = await service.get_masked()
    return SettingsResponse(
        github_configured=masked["github_configured"],
        github_has_token=masked.get("github_has_token", False),
        github_repos=masked["github_repos"],
        linear_configured=masked["linear_configured"],
        linear_workspace_name=masked["linear_workspace_name"],
        storage_available=masked["storage_available"],
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update stored credentials. Secrets are encrypted at rest.
    Omit a field to leave it unchanged. Requires VEELOCITY_ENCRYPTION_KEY to store secrets.
    """
    if not encryption_available() and (body.github_token or body.linear_api_key):
        raise HTTPException(
            status_code=400,
            detail="VEELOCITY_ENCRYPTION_KEY is not set; cannot store API keys in database",
        )
    service = CredentialsService(db)
    updates = {}
    if body.github_token is not None:
        updates["github_token"] = body.github_token
    if body.github_repos is not None:
        updates["github_repos"] = body.github_repos
    if body.linear_api_key is not None:
        updates["linear_api_key"] = body.linear_api_key
    if body.linear_workspace_name is not None:
        updates["linear_workspace_name"] = body.linear_workspace_name
    if updates:
        await service.set_credentials(**updates)
    masked = await service.get_masked()
    return SettingsResponse(
        github_configured=masked["github_configured"],
        github_has_token=masked.get("github_has_token", False),
        github_repos=masked["github_repos"],
        linear_configured=masked["linear_configured"],
        linear_workspace_name=masked["linear_workspace_name"],
        storage_available=masked["storage_available"],
    )
