from app.connectors.github import GitHubConnector
from app.connectors.github_actions import GitHubActionsConnector
from app.connectors.linear import LinearConnector


def create_github_connector(
    *,
    token: str | None = None,
    repos: str | None = None,
) -> GitHubConnector | None:
    """Create GitHubConnector from credentials. Returns None if not configured.
    Credentials must be passed from CredentialsService (DB); env vars are not used.
    """
    if not token or not (repos or "").strip():
        return None
    repo_list = [x.strip() for x in (repos or "").split(",") if x.strip()]
    if not repo_list:
        return None
    return GitHubConnector(token=token, repos=repo_list)


def create_github_actions_connector(
    *,
    token: str | None = None,
    repos: str | None = None,
) -> GitHubActionsConnector | None:
    """Create GitHubActionsConnector from credentials. Returns None if not configured.
    Credentials must be passed from CredentialsService (DB); env vars are not used.
    """
    if not token or not (repos or "").strip():
        return None
    repo_list = [x.strip() for x in (repos or "").split(",") if x.strip()]
    if not repo_list:
        return None
    return GitHubActionsConnector(token=token, repos=repo_list)


def create_linear_connector(
    *,
    api_key: str | None = None,
) -> LinearConnector | None:
    """Create LinearConnector from credentials. Returns None if not configured.
    Credentials must be passed from CredentialsService (DB); env vars are not used.
    """
    if not api_key:
        return None
    return LinearConnector(api_key=api_key)
