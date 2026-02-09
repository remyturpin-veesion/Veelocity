"""Resolve org:OrgName patterns in github_repos to actual repo lists via GitHub API."""

import logging

import httpx

logger = logging.getLogger(__name__)

ORG_PREFIX = "org:"


def parse_repo_entries(repos_raw: str) -> tuple[list[str], list[str]]:
    """
    Parse the github_repos string into (org_names, individual_repos).

    Entries prefixed with ``org:`` are treated as organization subscriptions;
    everything else is treated as an explicit ``owner/repo`` reference.
    """
    orgs: list[str] = []
    repos: list[str] = []
    for entry in (repos_raw or "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        if entry.startswith(ORG_PREFIX):
            org_name = entry[len(ORG_PREFIX) :].strip()
            if org_name:
                orgs.append(org_name)
        else:
            repos.append(entry)
    return orgs, repos


def extract_org_names(repos_raw: str) -> list[str]:
    """Return the list of org names from org:* entries in the repos string."""
    orgs, _ = parse_repo_entries(repos_raw)
    return orgs


async def _fetch_org_repos(client: httpx.AsyncClient, org: str) -> list[str]:
    """Fetch all repository full_names for a GitHub organization (paginated)."""
    collected: list[str] = []
    page = 1
    max_pages = 20  # safety limit: 20 * 100 = 2000 repos max

    while page <= max_pages:
        resp = await client.get(
            f"/orgs/{org}/repos",
            params={
                "type": "all",
                "sort": "full_name",
                "per_page": 100,
                "page": page,
            },
        )
        if resp.status_code == 404:
            logger.warning("Organization '%s' not found or no access — skipping", org)
            break
        if resp.status_code == 403:
            logger.warning(
                "GitHub API denied access for org '%s' (rate limit or permissions) — skipping",
                org,
            )
            break
        if resp.status_code != 200:
            logger.warning(
                "GitHub API error %s listing repos for org '%s' — skipping",
                resp.status_code,
                org,
            )
            break

        data = resp.json()
        if not data:
            break

        for repo in data:
            full_name = repo.get("full_name")
            if full_name:
                collected.append(full_name)

        if len(data) < 100:
            break
        page += 1

    return collected


async def resolve_github_repos(token: str, repos_raw: str) -> list[str]:
    """
    Resolve the stored ``github_repos`` string into a flat list of ``owner/repo``.

    * ``org:OrgName`` entries are expanded by listing all repos via GitHub API.
    * Plain ``owner/repo`` entries are kept as-is.
    * Duplicates are removed (preserving order).
    """
    orgs, explicit_repos = parse_repo_entries(repos_raw)

    if not orgs:
        # No org subscriptions — fast path, skip HTTP entirely
        return explicit_repos

    resolved: list[str] = []
    seen: set[str] = set()

    async with httpx.AsyncClient(
        base_url="https://api.github.com",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
        },
        timeout=30.0,
    ) as client:
        for org in orgs:
            try:
                org_repos = await _fetch_org_repos(client, org)
                logger.info("Resolved org:%s → %d repositories", org, len(org_repos))
                for repo in org_repos:
                    key = repo.lower()
                    if key not in seen:
                        seen.add(key)
                        resolved.append(repo)
            except Exception as e:
                logger.error("Failed to resolve repos for org '%s': %s", org, e)

    # Append explicit repos (deduped against org repos)
    for repo in explicit_repos:
        key = repo.lower()
        if key not in seen:
            seen.add(key)
            resolved.append(repo)

    return resolved
