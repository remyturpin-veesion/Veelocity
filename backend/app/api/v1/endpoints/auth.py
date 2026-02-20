"""User auth (register, login, me) and GitHub OAuth (authorize redirect and callback)."""

import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import encryption_available
from app.core.security import create_access_token
from app.schemas.auth import RegisterResponse, Token, UserCreate, UserLogin, UserOut
from app.models.user import User
from app.services.auth_service import authenticate_user, register_user
from app.services.credentials import CredentialsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
OAUTH_STATE_COOKIE = "oauth_state"
# Scopes needed for repo + Actions (same as typical PAT)
GITHUB_SCOPES = "repo,read:org,read:user"


def _oauth_available() -> bool:
    return bool(settings.github_oauth_client_id and settings.github_oauth_client_secret)


# ---- Email/password auth ----

@router.post("/register", response_model=Token | RegisterResponse)
async def auth_register(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new user account. If active (e.g. first user), returns token. Else returns message."""
    try:
        user = await register_user(db, body.email, body.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    if user.is_active:
        access_token = create_access_token(subject=user.id)
        return Token(
            access_token=access_token,
            user=UserOut.model_validate(user),
        )
    return RegisterResponse(
        user=UserOut.model_validate(user),
        message="Your account has been created. An active member must activate it before you can sign in.",
    )


@router.post("/login", response_model=Token)
async def auth_login(
    body: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password. Returns access token only if user is active."""
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending activation. An active member must activate your account before you can sign in.",
        )
    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def auth_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user (requires Bearer token)."""
    return UserOut.model_validate(current_user)


# ---- GitHub OAuth (for Settings "Connect with GitHub") ----

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
            return fail(
                "state mismatch (cookie may be missing if callback URL host/port differs from start)"
            )

        if not _oauth_available():
            return fail("OAuth not configured on server")

        # Exchange code for access token
        redirect_uri = (
            f"{settings.oauth_backend_base_url.rstrip('/')}/api/v1/auth/github/callback"
        )
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
            # Do not log response body (may contain tokens); log status only.
            logger.warning("GitHub token exchange failed: status=%s", resp.status_code)
            return RedirectResponse(url=redirect_fail)

        try:
            data = resp.json()
        except Exception as e:
            logger.warning(
                "GitHub token response not JSON: length=%s - %s",
                len(resp.text),
                e,
            )
            return RedirectResponse(url=redirect_fail)

        access_token = data.get("access_token")
        if not access_token:
            # GitHub may return 200 with error in body (e.g. redirect_uri_mismatch).
            # Log only error fields; never log full response (could contain token).
            err = data.get("error", "unknown")
            err_desc = data.get("error_description", "")
            logger.warning(
                "GitHub response missing access_token: error=%s error_description=%s",
                err,
                err_desc,
            )
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
