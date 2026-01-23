from app.connectors.github import GitHubConnector
from app.core.config import settings


def create_github_connector() -> GitHubConnector | None:
    """Create GitHubConnector from settings. Returns None if not configured."""
    if not settings.github_token or not settings.github_repos:
        return None
    repos = [r.strip() for r in settings.github_repos.split(",") if r.strip()]
    return GitHubConnector(token=settings.github_token, repos=repos)
