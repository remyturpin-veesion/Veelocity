from app.connectors.github import GitHubConnector
from app.connectors.github_actions import GitHubActionsConnector
from app.connectors.linear import LinearConnector
from app.core.config import settings


def create_github_connector() -> GitHubConnector | None:
    """Create GitHubConnector from settings. Returns None if not configured."""
    if not settings.github_token or not settings.github_repos:
        return None
    repos = [r.strip() for r in settings.github_repos.split(",") if r.strip()]
    return GitHubConnector(token=settings.github_token, repos=repos)


def create_github_actions_connector() -> GitHubActionsConnector | None:
    """Create GitHubActionsConnector from settings. Returns None if not configured."""
    if not settings.github_token or not settings.github_repos:
        return None
    repos = [r.strip() for r in settings.github_repos.split(",") if r.strip()]
    return GitHubActionsConnector(token=settings.github_token, repos=repos)


def create_linear_connector() -> LinearConnector | None:
    """Create LinearConnector from settings. Returns None if not configured."""
    if not settings.linear_api_key:
        return None
    return LinearConnector(api_key=settings.linear_api_key)
