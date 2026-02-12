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


def _repository_id_with_lowercase_repo(repository_id: str) -> str | None:
    """
    Build repository_id with the owner/repo part in lowercase.
    Format: remote:branch:owner/repo. Returns None if already lowercase or invalid.
    """
    parts = repository_id.split(":", 2)
    if len(parts) != 3:
        return None
    remote, branch, repo_name = parts
    repo_lower = repo_name.lower()
    if repo_lower == repo_name:
        return None
    return f"{remote}:{branch}:{repo_lower}"


async def get_repository(
    api_key: str,
    repository_id: str,
    github_token: str | None = None,
    return_error: bool = False,
) -> dict[str, Any] | None:
    """
    GET /repositories/{repositoryId}. repository_id format: remote:branch:owner/repo
    e.g. github:main:owner/repo (URL-encoded when used in path).
    On 404, retries once with owner/repo in lowercase (Greptile may store repos in lowercase).
    If return_error=True, returns {"_error": status_code, "_body": ...} instead of None on failure.
    """
    import urllib.parse

    async def _get(rid: str) -> tuple[int | None, dict[str, Any] | None]:
        try:
            encoded_id = urllib.parse.quote(rid, safe="")
            async with httpx.AsyncClient(
                base_url=GREPTILE_API_BASE,
                headers=_headers(api_key, github_token),
                timeout=15.0,
            ) as client:
                resp = await client.get(f"/repositories/{encoded_id}")
                if resp.status_code == 200:
                    return 200, resp.json()
                log_level = logging.DEBUG if resp.status_code == 404 else logging.WARNING
                logger.log(
                    log_level,
                    "Greptile get_repository %s: HTTP %s — %s (github_token=%s)",
                    rid,
                    resp.status_code,
                    resp.text[:200],
                    "present" if github_token else "missing",
                )
                if return_error:
                    return resp.status_code, {"_error": resp.status_code, "_body": resp.text[:300]}
                return resp.status_code, None
        except Exception as e:
            logger.debug("Greptile get repository %s failed: %s", rid, e)
            if return_error:
                return None, {"_error": "exception", "_body": str(e)}
            return None, None

    status, result = await _get(repository_id)
    if status == 200 and result is not None:
        return result
    # On 404, retry with lowercase owner/repo (Greptile may use lowercase)
    if status == 404 and result is not None:
        fallback_id = _repository_id_with_lowercase_repo(repository_id)
        if fallback_id:
            logger.info("Greptile get_repository: retrying with lowercase repo id %s", fallback_id)
            _, fallback_result = await _get(fallback_id)
            if fallback_result is not None and "_error" not in fallback_result:
                return fallback_result
            if return_error and fallback_result is not None:
                return fallback_result
    return result


def _is_not_found_error(status_code: int, body: str) -> bool:
    """True if response looks like a 'repo not found' from Greptile."""
    if status_code == 404:
        return True
    if status_code == 400 and body:
        body_lower = body.lower()
        return "not found" in body_lower or "not_found" in body_lower
    return False


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
    On 404 or 'not found' error, retries once with repository name in lowercase (Greptile may expect lowercase).
    Returns the API response dict on success, None on failure.
    """
    async def _post(repo_name: str) -> tuple[int | None, dict[str, Any] | None]:
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
                    "repository": repo_name,
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
                        repo_name,
                        branch,
                        reload,
                        data.get("message", "ok"),
                    )
                    return resp.status_code, data
                logger.warning(
                    "Greptile index_repository %s/%s (%s) failed: HTTP %s — %s",
                    remote,
                    repo_name,
                    branch,
                    resp.status_code,
                    resp.text[:300],
                )
                return resp.status_code, {"_error": resp.status_code, "_body": resp.text[:300]}
        except Exception as e:
            logger.exception("Greptile index_repository failed: %s", e)
            return None, {"_error": "exception", "_body": str(e)}

    status, result = await _post(repository)
    if status in (200, 201, 202) and result is not None and "_error" not in result:
        return result
    # On not found, retry with lowercase repo name (Greptile may use lowercase)
    repo_lower = repository.lower()
    if repo_lower != repository and result is not None and "_error" in result:
        body = (result.get("_body") or "")[:500]
        if _is_not_found_error(result.get("_error") or 0, body):
            logger.info("Greptile index_repository: retrying with lowercase repository %s", repo_lower)
            _, fallback_result = await _post(repo_lower)
            if fallback_result is not None and "_error" not in fallback_result:
                return fallback_result
            if fallback_result is not None:
                return fallback_result
    return result


async def validate_api_key(api_key: str) -> bool:
    """Validate API key by calling list or a minimal request. Returns True if key seems valid."""
    result = await list_repositories(api_key)
    # None = auth error, [] = no list endpoint or no repos
    if result is None:
        return False
    return True
