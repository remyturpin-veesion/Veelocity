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

    # Linear
    linear_api_key: str | None = None

    # Sync
    deployment_patterns: str = "deploy,release,publish"  # Comma-separated


settings = Settings()
