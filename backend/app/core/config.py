from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra vars like POSTGRES_* used by Docker
    )

    app_name: str = "Veelocity"
    debug: bool = False

    # Database (port 5433 matches docker-compose default)
    database_url: str = (
        "postgresql+asyncpg://veelocity:veelocity@localhost:5433/veelocity"
    )

    # GitHub/Linear credentials are stored in the database (encrypted), not read from env.
    # These fields are kept for backward compatibility but are unused by connectors.
    github_token: str | None = None
    github_repos: str = ""
    linear_api_key: str | None = None
    linear_workspace_name: str = ""

    # Encryption for credentials stored in DB (Fernet key, base64). Required to save keys via Settings UI.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str | None = Field(
        default=None,
        validation_alias="VEELOCITY_ENCRYPTION_KEY",
    )

    # Sync
    deployment_patterns: str = "deploy,release,publish"  # Comma-separated

    # Pagination guard rails
    pagination_default_limit: int = 20
    pagination_max_limit: int = 100  # Hard limit, cannot be exceeded

    # GitHub OAuth (optional – if set, "Connect with GitHub" in Settings uses OAuth instead of only PAT)
    github_oauth_client_id: str | None = None
    github_oauth_client_secret: str | None = None
    # URL where the backend is reachable (for OAuth callback). e.g. http://localhost:8000
    oauth_backend_base_url: str = "http://localhost:8000"
    # Where to redirect the user after successful GitHub OAuth. e.g. http://localhost:5173
    oauth_frontend_redirect_url: str = "http://localhost:5173"

    # Rate limiting for API calls
    rate_limit_max_per_sync: int = (
        1200  # Max API calls per sync (increase if you have many repos)
    )
    rate_limit_max_per_hour: int = 4000  # Max API calls per hour (GitHub limit is 5000)
    rate_limit_delay_ms: int = 100  # Delay between API calls in milliseconds

    # Greptile bot login (the GitHub username used by Greptile for PR reviews)
    greptile_bot_login: str = "greptile[bot]"

    # Sentry (optional – error reporting; DSN from project Client Keys in Sentry UI)
    sentry_dsn: str | None = None
    sentry_environment: str = "development"  # e.g. development, staging, production

    # CORS: comma-separated origins (e.g. https://veelocity.example.com). If empty, allow all (dev-friendly).
    cors_allowed_origins: str = ""

    # JWT auth (required for user login). Use a long random secret in production.
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    jwt_secret_key: str = Field(
        default="change-me-in-production-use-secrets-token-urlsafe-32",
        validation_alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days


settings = Settings()


def is_deployment_workflow(name: str, path: str) -> bool:
    """
    Check if workflow name or path matches deployment patterns.

    Patterns are configured via DEPLOYMENT_PATTERNS env var.
    Default patterns: deploy, release, publish
    """
    patterns = [
        p.strip().lower() for p in settings.deployment_patterns.split(",") if p.strip()
    ]
    name_lower = name.lower()
    path_lower = path.lower()
    return any(pattern in name_lower or pattern in path_lower for pattern in patterns)
