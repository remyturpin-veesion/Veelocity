from app.connectors.github import GitHubConnector
from app.connectors.github_actions import GitHubActionsConnector
from app.connectors.linear import LinearConnector


def _parse_repos(repos: str | list[str] | None) -> list[str]:
    """Normalize repos to a list of owner/repo strings.

    Accepts either a comma-separated string or a pre-resolved list.
    """
    if repos is None:
        return []
    if isinstance(repos, list):
        return [r for r in repos if r]
    return [x.strip() for x in repos.split(",") if x.strip()]


def create_github_connector(
    *,
    token: str | None = None,
    repos: str | list[str] | None = None,
) -> GitHubConnector | None:
    """Create GitHubConnector from credentials. Returns None if not configured.

    ``repos`` may be a comma-separated string (legacy) or a pre-resolved list
    (e.g. after org:* expansion via ``resolve_github_repos``).
    Credentials must be passed from CredentialsService (DB); env vars are not used.
    """
    if not token:
        return None
    repo_list = _parse_repos(repos)
    if not repo_list:
        return None
    return GitHubConnector(token=token, repos=repo_list)


def create_github_actions_connector(
    *,
    token: str | None = None,
    repos: str | list[str] | None = None,
) -> GitHubActionsConnector | None:
    """Create GitHubActionsConnector from credentials. Returns None if not configured.

    ``repos`` may be a comma-separated string (legacy) or a pre-resolved list
    (e.g. after org:* expansion via ``resolve_github_repos``).
    Credentials must be passed from CredentialsService (DB); env vars are not used.
    """
    if not token:
        return None
    repo_list = _parse_repos(repos)
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
