from pydantic import BaseModel


class SettingsResponse(BaseModel):
    """Public/masked settings (no secrets)."""

    github_configured: bool
    github_has_token: bool = False  # True when token is set (e.g. after OAuth), even if repos not set
    github_repos: str
    linear_configured: bool
    linear_workspace_name: str
    cursor_configured: bool = False
    greptile_configured: bool = False
    storage_available: bool


class SettingsUpdate(BaseModel):
    """Optional fields for updating settings (send only what changes)."""

    github_token: str | None = None
    github_repos: str | None = None
    linear_api_key: str | None = None
    linear_workspace_name: str | None = None
    cursor_api_key: str | None = None
    greptile_api_key: str | None = None


class GitHubRepoItem(BaseModel):
    """One repository from GitHub API (for settings repo picker)."""

    id: int
    full_name: str
    name: str


class GitHubReposResponse(BaseModel):
    """List of GitHub repos the authenticated user can access."""

    items: list[GitHubRepoItem]


class GitHubOrgItem(BaseModel):
    """One organization from GitHub API (for repo source selector)."""

    login: str
    id: int


class GitHubOrgsResponse(BaseModel):
    """List of GitHub organizations the user is a member of."""

    items: list[GitHubOrgItem]
