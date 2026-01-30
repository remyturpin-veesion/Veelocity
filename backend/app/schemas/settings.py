from pydantic import BaseModel


class SettingsResponse(BaseModel):
    """Public/masked settings (no secrets)."""

    github_configured: bool
    github_repos: str
    linear_configured: bool
    linear_workspace_name: str
    storage_available: bool


class SettingsUpdate(BaseModel):
    """Optional fields for updating settings (send only what changes)."""

    github_token: str | None = None
    github_repos: str | None = None
    linear_api_key: str | None = None
    linear_workspace_name: str | None = None
