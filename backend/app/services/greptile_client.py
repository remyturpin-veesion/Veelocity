"""Greptile API client using stored API key (Bearer token)."""

import logging
from typing import Any

import httpx

GREPTILE_API_BASE = "https://api.greptile.com/v2"

logger = logging.getLogger(__name__)


def _headers(api_key: str, github_token: str | None = None) -> dict[str, str]:
    h: dict[str, str] = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Accept": "application/json",
    }
    if github_token:
        h["X-GitHub-Token"] = github_token.strip()
    return h


async def list_repositories(
    api_key: str, github_token: str | None = None
) -> list[dict[str, Any]] | None:
    """
    Try to list repositories. GET /repositories may return a list (not in public docs).
    Returns None on auth/error; empty list if no repos or endpoint not available.
    """
    try:
        async with httpx.AsyncClient(
            base_url=GREPTILE_API_BASE,
            headers={
                **_headers(api_key, github_token),
                "Content-Type": "application/json",
            },
            timeout=15.0,
        ) as client:
            resp = await client.get("/repositories")
            if resp.status_code == 401:
                logger.warning("Greptile API: invalid API key")
                return None
            if resp.status_code == 403:
                logger.warning("Greptile API: forbidden")
                return None
            if resp.status_code == 429:
                logger.warning("Greptile API: rate limited")
                return None
            if resp.status_code == 404 or resp.status_code == 405:
                # No list endpoint or method not allowed
                return []
            if resp.status_code != 200:
                logger.warning(
                    "Greptile API list repos: %s %s", resp.status_code, resp.text[:200]
                )
                return []
            data = resp.json()
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "repositories" in data:
                return data["repositories"]
            if isinstance(data, dict) and "items" in data:
                return data["items"]
            return []
    except Exception as e:
        logger.exception("Greptile API list repositories failed: %s", e)
        return None


async def get_repository(
    api_key: str,
    repository_id: str,
    github_token: str | None = None,
    return_error: bool = False,
) -> dict[str, Any] | None:
    """
    GET /repositories/{repositoryId}. repository_id format: remote:branch:owner/repo
    e.g. github:main:owner/repo (URL-encoded when used in path).
    If return_error=True, returns {"_error": status_code, "_body": ...} instead of None on failure.
    """
    import urllib.parse

    try:
        encoded_id = urllib.parse.quote(repository_id, safe="")
        async with httpx.AsyncClient(
            base_url=GREPTILE_API_BASE,
            headers=_headers(api_key, github_token),
            timeout=15.0,
        ) as client:
            resp = await client.get(f"/repositories/{encoded_id}")
            if resp.status_code == 200:
                return resp.json()
            # 404 is expected for repos not indexed in Greptile — log at DEBUG
            log_level = logging.DEBUG if resp.status_code == 404 else logging.WARNING
            logger.log(
                log_level,
                "Greptile get_repository %s: HTTP %s — %s (github_token=%s)",
                repository_id,
                resp.status_code,
                resp.text[:200],
                "present" if github_token else "missing",
            )
            if return_error:
                return {"_error": resp.status_code, "_body": resp.text[:300]}
            return None
    except Exception as e:
        logger.debug("Greptile get repository %s failed: %s", repository_id, e)
        if return_error:
            return {"_error": "exception", "_body": str(e)}
        return None


async def index_repository(
    api_key: str,
    remote: str,
    repository: str,
    branch: str,
    github_token: str | None = None,
    reload: bool = False,
) -> dict[str, Any] | None:
    """
    POST /repositories — trigger indexing (or re-indexing with reload=True) of a repo.
    Returns the API response dict on success, None on failure.
    """
    try:
        async with httpx.AsyncClient(
            base_url=GREPTILE_API_BASE,
            headers={
                **_headers(api_key, github_token),
                "Content-Type": "application/json",
            },
            timeout=30.0,
        ) as client:
            body = {
                "remote": remote,
                "repository": repository,
                "branch": branch,
                "reload": reload,
                "notify": False,
            }
            resp = await client.post("/repositories", json=body)
            if resp.status_code in (200, 201, 202):
                data = resp.json()
                logger.info(
                    "Greptile index_repository %s/%s (%s, reload=%s): %s",
                    remote,
                    repository,
                    branch,
                    reload,
                    data.get("message", "ok"),
                )
                return data
            logger.warning(
                "Greptile index_repository %s/%s (%s) failed: HTTP %s — %s",
                remote,
                repository,
                branch,
                resp.status_code,
                resp.text[:300],
            )
            return {"_error": resp.status_code, "_body": resp.text[:300]}
    except Exception as e:
        logger.exception("Greptile index_repository failed: %s", e)
        return {"_error": "exception", "_body": str(e)}


async def validate_api_key(api_key: str) -> bool:
    """Validate API key by calling list or a minimal request. Returns True if key seems valid."""
    result = await list_repositories(api_key)
    # None = auth error, [] = no list endpoint or no repos
    if result is None:
        return False
    return True
