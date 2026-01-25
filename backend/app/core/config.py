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

    # GitHub
    github_token: str | None = None
    github_repos: str = ""  # Comma-separated: "owner/repo1,owner/repo2"

    # Linear
    linear_api_key: str | None = None

    # Sync
    deployment_patterns: str = "deploy,release,publish"  # Comma-separated

    # Pagination guard rails
    pagination_default_limit: int = 20
    pagination_max_limit: int = 100  # Hard limit, cannot be exceeded

    # Rate limiting for API calls
    rate_limit_max_per_sync: int = 500  # Max API calls per sync session
    rate_limit_max_per_hour: int = 4000  # Max API calls per hour (GitHub limit is 5000)
    rate_limit_delay_ms: int = 100  # Delay between API calls in milliseconds


settings = Settings()


def is_deployment_workflow(name: str, path: str) -> bool:
    """
    Check if workflow name or path matches deployment patterns.
    
    Patterns are configured via DEPLOYMENT_PATTERNS env var.
    Default patterns: deploy, release, publish
    """
    patterns = [p.strip().lower() for p in settings.deployment_patterns.split(",") if p.strip()]
    name_lower = name.lower()
    path_lower = path.lower()
    return any(pattern in name_lower or pattern in path_lower for pattern in patterns)
