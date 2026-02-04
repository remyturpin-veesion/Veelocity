import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import encryption_available
from app.schemas.settings import (
    GitHubOrgItem,
    GitHubOrgsResponse,
    GitHubRepoItem,
    GitHubReposResponse,
    SettingsResponse,
    SettingsUpdate,
)
from app.services.credentials import CredentialsService

logger = logging.getLogger(__name__)
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
        if (body.github_token or "").strip() == "":
            await service.clear_github_token()
        else:
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


def _github_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }


@router.get("/github/orgs", response_model=GitHubOrgsResponse)
async def list_github_orgs(db: AsyncSession = Depends(get_db)):
    """
    List GitHub organizations the authenticated user is a member of.
    Used by the Settings UI to choose repo source (my account vs organization).
    Returns 403 if no token is set. Token should have read:org scope for org list.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.github_token:
        raise HTTPException(
            status_code=403,
            detail="No GitHub token configured. Connect with GitHub in Settings first.",
        )
    items: list[GitHubOrgItem] = []
    try:
        async with httpx.AsyncClient(
            base_url="https://api.github.com",
            headers=_github_headers(creds.github_token),
            timeout=15.0,
        ) as client:
            resp = await client.get("/user/orgs", params={"per_page": 100})
            if resp.status_code == 403:
                raise HTTPException(
                    status_code=502,
                    detail="GitHub API: access denied. Ensure OAuth has read:org scope for organizations.",
                )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"GitHub API error: {resp.status_code}",
                )
            data = resp.json()
            items = [
                GitHubOrgItem(login=org.get("login", ""), id=org.get("id", 0))
                for org in data
                if org.get("login")
            ]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list GitHub orgs")
        raise HTTPException(status_code=502, detail=str(e)) from e
    return GitHubOrgsResponse(items=items)


@router.get("/github/repos", response_model=GitHubReposResponse)
async def list_github_repos(
    q: Annotated[str | None, Query(description="Filter repos by name (case-insensitive)")] = None,
    per_page: Annotated[int, Query(ge=1, le=100, description="Max repos to return")] = 50,
    org: Annotated[
        str | None,
        Query(description="Organization login to list repos from (e.g. Veesion). Omit for user repos."),
    ] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List GitHub repositories. Without org: user's repos. With org: that organization's repos.
    Uses stored token. Returns 403 if no token is set.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.github_token:
        raise HTTPException(
            status_code=403,
            detail="No GitHub token configured. Connect with GitHub in Settings first.",
        )
    items: list[GitHubRepoItem] = []
    try:
        async with httpx.AsyncClient(
            base_url="https://api.github.com",
            headers=_github_headers(creds.github_token),
            timeout=15.0,
        ) as client:
            page = 1
            collected: list[dict] = []
            query_lower = (q or "").strip().lower()
            if org:
                # List organization repos: GET /orgs/{org}/repos
                while len(collected) < per_page:
                    resp = await client.get(
                        f"/orgs/{org}/repos",
                        params={
                            "sort": "full_name",
                            "per_page": min(100, per_page + 50),
                            "page": page,
                            "type": "all",
                        },
                    )
                    if resp.status_code == 404:
                        raise HTTPException(status_code=404, detail=f"Organization '{org}' not found or no access.")
                    if resp.status_code == 403:
                        raise HTTPException(
                            status_code=502,
                            detail="GitHub API access denied or rate limited. Try again later.",
                        )
                    if resp.status_code != 200:
                        raise HTTPException(
                            status_code=502,
                            detail=f"GitHub API error: {resp.status_code}",
                        )
                    data = resp.json()
                    if not data:
                        break
                    for repo in data:
                        full_name = repo.get("full_name") or ""
                        if query_lower and query_lower not in full_name.lower():
                            continue
                        collected.append({
                            "id": repo["id"],
                            "full_name": full_name,
                            "name": repo.get("name") or full_name.split("/")[-1],
                        })
                        if len(collected) >= per_page:
                            break
                    if len(data) < 100:
                        break
                    page += 1
                    if page > 5:
                        break
            else:
                # List user repos: GET /user/repos
                while len(collected) < per_page:
                    resp = await client.get(
                        "/user/repos",
                        params={
                            "type": "all",
                            "sort": "full_name",
                            "per_page": min(100, per_page + 50),
                            "page": page,
                        },
                    )
                    if resp.status_code != 200:
                        if resp.status_code == 403:
                            raise HTTPException(
                                status_code=502,
                                detail="GitHub API access denied or rate limited. Try again later.",
                            )
                        raise HTTPException(
                            status_code=502,
                            detail=f"GitHub API error: {resp.status_code}",
                        )
                    data = resp.json()
                    if not data:
                        break
                    for repo in data:
                        full_name = repo.get("full_name") or ""
                        if query_lower and query_lower not in full_name.lower():
                            continue
                        collected.append({
                            "id": repo["id"],
                            "full_name": full_name,
                            "name": repo.get("name") or full_name.split("/")[-1],
                        })
                        if len(collected) >= per_page:
                            break
                    if len(data) < 100:
                        break
                    page += 1
                    if page > 5:
                        break
            items = [GitHubRepoItem(**x) for x in collected[:per_page]]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list GitHub repos")
        raise HTTPException(status_code=502, detail=str(e)) from e
    return GitHubReposResponse(items=items)
