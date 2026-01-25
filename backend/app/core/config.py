from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Veelocity"
    debug: bool = False

    # Database
    database_url: str = (
        "postgresql+asyncpg://veelocity:veelocity@localhost:5432/veelocity"
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
