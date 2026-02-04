"""GitHub OAuth: authorize redirect and callback to store access token."""

import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.encryption import encryption_available
from app.services.credentials import CredentialsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
OAUTH_STATE_COOKIE = "oauth_state"
# Scopes needed for repo + Actions (same as typical PAT)
GITHUB_SCOPES = "repo,read:org,read:user"


def _oauth_available() -> bool:
    return bool(
        settings.github_oauth_client_id and settings.github_oauth_client_secret
    )


@router.get("/github/status")
async def auth_github_status():
    """Return whether GitHub OAuth is configured (so the frontend can show 'Connect with GitHub')."""
    return {"enabled": _oauth_available()}


@router.get("/github")
async def auth_github_start(request: Request):
    """
    Redirect the user to GitHub to authorize the app.
    Requires GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET to be set.
    """
    if not _oauth_available():
        # Redirect to frontend with error param so Settings can show a message
        base = (settings.oauth_frontend_redirect_url or "").rstrip("/")
        return RedirectResponse(url=f"{base}/?github_oauth_error=not_configured")
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.github_oauth_client_id,
        "redirect_uri": f"{settings.oauth_backend_base_url.rstrip('/')}/api/v1/auth/github/callback",
        "scope": GITHUB_SCOPES,
        "state": state,
    }
    url = f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"
    response = RedirectResponse(url=url, status_code=302)
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/github/callback")
async def auth_github_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    GitHub redirects here after user authorizes. Exchange code for access token
    and store it; then redirect to frontend.
    """
    frontend_base = (settings.oauth_frontend_redirect_url or "").rstrip("/")
    redirect_fail = f"{frontend_base}/?github_oauth_error=callback_failed"
    redirect_success = f"{frontend_base}/?github_connected=1"

    def fail(msg: str) -> RedirectResponse:
        logger.warning("GitHub OAuth callback: %s", msg)
        return RedirectResponse(url=redirect_fail)

    try:
        if error:
            logger.warning("GitHub OAuth error: %s - %s", error, error_description)
            return RedirectResponse(url=f"{redirect_fail}&error={error}")

        if not code or not state:
            return fail("missing code or state")

        cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
        if not cookie_state or not secrets.compare_digest(cookie_state, state):
            return fail("state mismatch (cookie may be missing if callback URL host/port differs from start)")

        if not _oauth_available():
            return fail("OAuth not configured on server")

        # Exchange code for access token
        redirect_uri = f"{settings.oauth_backend_base_url.rstrip('/')}/api/v1/auth/github/callback"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GITHUB_ACCESS_TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_oauth_client_id,
                    "client_secret": settings.github_oauth_client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
        if resp.status_code != 200:
            logger.warning(
                "GitHub token exchange failed: %s %s", resp.status_code, resp.text
            )
            return RedirectResponse(url=redirect_fail)

        try:
            data = resp.json()
        except Exception as e:
            logger.warning("GitHub token response not JSON: %s - %s", resp.text, e)
            return RedirectResponse(url=redirect_fail)

        access_token = data.get("access_token")
        if not access_token:
            # GitHub may return 200 with error in body (e.g. redirect_uri_mismatch)
            err = data.get("error", "unknown")
            logger.warning("GitHub response missing access_token: error=%s %s", err, data)
            return RedirectResponse(url=redirect_fail)

        if not encryption_available():
            logger.warning("Cannot store GitHub token: encryption not configured")
            return RedirectResponse(
                url=f"{frontend_base}/?github_oauth_error=encryption_required"
            )

        service = CredentialsService(db)
        await service.set_credentials(github_token=access_token)

        response = RedirectResponse(url=redirect_success, status_code=302)
        response.delete_cookie(OAUTH_STATE_COOKIE)
        return response

    except Exception as e:
        logger.exception("GitHub OAuth callback unhandled error: %s", e)
        return RedirectResponse(url=redirect_fail)
