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
