import logging
from datetime import datetime, timezone

import httpx

from app.connectors.base import BaseConnector
from app.connectors.rate_limiter import RateLimitExceeded, get_rate_limiter
from app.schemas.connector import SyncResult

logger = logging.getLogger(__name__)


class GitHubConnector(BaseConnector):
    """Connector for GitHub REST API."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str, repos: list[str]):
        self._token = token
        self._repos = repos
        self._rate_limit_logged = False  # Only log once per sync when sync limit is hit
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            timeout=30.0,
        )
        self._rate_limiter = get_rate_limiter()

    async def _get(self, path: str, **kwargs) -> httpx.Response:
        """Make a rate-limited GET request."""
        await self._rate_limiter.acquire()
        response = await self._client.get(path, **kwargs)

        # Update rate limiter with GitHub's actual rate limit info
        self._update_rate_limit_from_response(response)

        return response

    def _update_rate_limit_from_response(self, response: httpx.Response) -> None:
        """Extract and update rate limit info from GitHub response headers."""
        remaining_str = response.headers.get("x-ratelimit-remaining")
        reset_str = response.headers.get("x-ratelimit-reset")
        limit_str = response.headers.get("x-ratelimit-limit")

        remaining = int(remaining_str) if remaining_str else None
        reset_timestamp = int(reset_str) if reset_str else None
        limit = int(limit_str) if limit_str else None

        self._rate_limiter.update_from_github_headers(remaining, reset_timestamp, limit)

        # Log when approaching limit (for visibility)
        if remaining is not None and remaining < 100:
            logger.warning(f"GitHub API rate limit low: {remaining} remaining")

    @property
    def name(self) -> str:
        return "github"

    def get_supported_metrics(self) -> list[str]:
        return ["pr_review_time", "pr_merge_time", "throughput"]

    async def test_connection(self) -> bool:
        response = await self._client.get("/user")  # Don't rate limit test
        return response.status_code == 200

    async def fetch_repos(self) -> list[dict]:
        repos = []
        for repo_full_name in self._repos:
            response = await self._get(f"/repos/{repo_full_name}")
            if response.status_code == 200:
                data = response.json()
                repos.append(
                    {
                        "github_id": data["id"],
                        "name": data["name"],
                        "full_name": data["full_name"],
                        "default_branch": data.get("default_branch", "main"),
                    }
                )
        return repos

    async def fetch_pull_requests(
        self,
        repo_full_name: str,
        state: str = "all",
        per_page: int = 100,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[dict]:
        """
        Fetch pull requests from a repository.

        Args:
            repo_full_name: Repository full name (owner/repo)
            state: PR state filter (all, open, closed)
            per_page: Results per page
            since: Only fetch PRs updated after this datetime (incremental sync)
            until: Only include PRs updated before this datetime (for date-range import)
        """
        prs = []
        page = 1

        while True:
            params = {
                "state": state,
                "per_page": per_page,
                "page": page,
                "sort": "updated",
                "direction": "desc",
            }

            try:
                response = await self._get(
                    f"/repos/{repo_full_name}/pulls",
                    params=params,
                )
            except RateLimitExceeded as e:
                if not self._rate_limit_logged:
                    self._rate_limit_logged = True
                    logger.warning(
                        "Rate limit hit while fetching PRs: %s (further repos skipped this sync)",
                        e,
                    )
                else:
                    logger.debug(
                        "Rate limit already hit, skipping PRs for %s", repo_full_name
                    )
                break
            if response.status_code != 200:
                break
            data = response.json()
            if not data:
                break

            # Track if we've passed the since threshold
            found_old_pr = False

            for pr in data:
                pr_updated_at = pr["updated_at"]
                from datetime import datetime as dt

                updated = dt.fromisoformat(pr_updated_at.replace("Z", "+00:00"))

                # If we have a since filter, check if this PR is older
                if since:
                    since_aware = (
                        since if since.tzinfo else since.replace(tzinfo=updated.tzinfo)
                    )
                    if updated < since_aware:
                        found_old_pr = True
                        continue  # Skip PRs not updated since last sync

                # If we have an until filter, skip PRs updated after that time
                if until:
                    until_aware = (
                        until if until.tzinfo else until.replace(tzinfo=updated.tzinfo)
                    )
                    if updated > until_aware:
                        continue

                prs.append(
                    {
                        "github_id": pr["id"],
                        "number": pr["number"],
                        "title": pr["title"],
                        "body": pr.get("body"),
                        "state": pr["state"],
                        "draft": pr.get("draft", False),
                        "author_login": pr["user"]["login"],
                        "author_avatar": pr["user"].get("avatar_url"),
                        "created_at": pr["created_at"],
                        "updated_at": pr["updated_at"],
                        "merged_at": pr.get("merged_at"),
                        "closed_at": pr.get("closed_at"),
                        "additions": pr.get("additions", 0),
                        "deletions": pr.get("deletions", 0),
                        "commits_count": pr.get("commits", 0),
                    }
                )

            # If we found an old PR and have since filter, stop paginating
            if found_old_pr and since:
                break

            page += 1

            # Safety limit to avoid infinite loops
            if page > 50:
                break

        return prs

    async def fetch_pull_request_details(
        self, repo_full_name: str, pr_number: int
    ) -> dict | None:
        """
        Fetch a single PR to get additions, deletions, commits_count.

        The list-pulls endpoint does not return these fields; only GET pull does.
        """
        try:
            response = await self._get(
                f"/repos/{repo_full_name}/pulls/{pr_number}",
            )
        except RateLimitExceeded as e:
            stats = self._rate_limiter.get_stats()
            logger.warning(
                f"Rate limit hit fetching PR #{pr_number} details: {e} "
                f"(sync: {stats['calls_made']}/{stats['max_per_sync']}, "
                f"hourly: {stats['hourly_calls']}/{stats['max_per_hour']})"
            )
            return None
        if response.status_code != 200:
            return None
        pr = response.json()
        return {
            "additions": pr.get("additions", 0),
            "deletions": pr.get("deletions", 0),
            "commits_count": pr.get("commits", 0),
        }

    async def fetch_reviews(self, repo_full_name: str, pr_number: int) -> list[dict]:
        try:
            response = await self._get(
                f"/repos/{repo_full_name}/pulls/{pr_number}/reviews",
                params={"per_page": 100},
            )
        except RateLimitExceeded as e:
            stats = self._rate_limiter.get_stats()
            logger.warning(
                f"Rate limit hit fetching reviews for PR #{pr_number}: {e} "
                f"(sync: {stats['calls_made']}/{stats['max_per_sync']}, "
                f"hourly: {stats['hourly_calls']}/{stats['max_per_hour']})"
            )
            return []
        if response.status_code != 200:
            return []
        return [
            {
                "github_id": review["id"],
                "reviewer_login": review["user"]["login"],
                "state": review["state"].lower(),
                "submitted_at": review["submitted_at"],
            }
            for review in response.json()
        ]

    async def fetch_comments(self, repo_full_name: str, pr_number: int) -> list[dict]:
        try:
            response = await self._get(
                f"/repos/{repo_full_name}/pulls/{pr_number}/comments",
                params={"per_page": 100},
            )
        except RateLimitExceeded as e:
            stats = self._rate_limiter.get_stats()
            logger.warning(
                f"Rate limit hit fetching comments for PR #{pr_number}: {e} "
                f"(sync: {stats['calls_made']}/{stats['max_per_sync']}, "
                f"hourly: {stats['hourly_calls']}/{stats['max_per_hour']})"
            )
            return []
        if response.status_code != 200:
            return []
        return [
            {
                "github_id": comment["id"],
                "author_login": comment["user"]["login"],
                "body": comment["body"],
                "created_at": comment["created_at"],
            }
            for comment in response.json()
        ]

    async def fetch_pr_commits(self, repo_full_name: str, pr_number: int) -> list[dict]:
        try:
            response = await self._get(
                f"/repos/{repo_full_name}/pulls/{pr_number}/commits",
                params={"per_page": 100},
            )
        except RateLimitExceeded as e:
            stats = self._rate_limiter.get_stats()
            logger.warning(
                f"Rate limit hit fetching commits for PR #{pr_number}: {e} "
                f"(sync: {stats['calls_made']}/{stats['max_per_sync']}, "
                f"hourly: {stats['hourly_calls']}/{stats['max_per_hour']})"
            )
            return []
        if response.status_code != 200:
            return []
        return [
            {
                "sha": commit["sha"],
                "author_login": (commit.get("author") or {}).get("login")
                or commit["commit"]["author"].get("name", "unknown"),
                "message": commit["commit"]["message"],
                "committed_at": commit["commit"]["author"]["date"],
            }
            for commit in response.json()
        ]

    async def sync_all(self, db, fetch_details: bool = True) -> SyncResult:
        """
        Full sync of all repositories.

        Args:
            db: Database session
            fetch_details: If True, fetch reviews/comments/commits (slow).
                          If False, just fetch PRs (fast initial sync).
        """
        started_at = datetime.now(timezone.utc)
        items_synced = 0
        errors = []

        # Reset rate limiter and log flag for new sync session
        self._rate_limiter.reset()
        self._rate_limit_logged = False

        from app.services.sync import SyncService

        sync_service = SyncService(db, self)
        try:
            items_synced = await sync_service.sync_all(fetch_details=fetch_details)
        except RateLimitExceeded as e:
            errors.append(f"Rate limit exceeded: {e}")
            logger.error(f"Sync stopped due to rate limit: {e}")
        except Exception as e:
            errors.append(str(e))

        # Log rate limiter stats
        stats = self._rate_limiter.get_stats()
        logger.info(
            f"Sync complete. API calls: {stats['calls_made']}/{stats['max_per_sync']}"
        )

        return SyncResult(
            connector_name=self.name,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            items_synced=items_synced,
            errors=errors,
        )

    async def sync_recent(self, db, since: datetime | None = None) -> SyncResult:
        """
        Incremental sync using last_sync_at from database.

        If since is provided, uses that. Otherwise uses stored last_sync_at.
        """
        started_at = datetime.now(timezone.utc)
        items_synced = 0
        errors = []

        # Reset rate limiter and log flag for new sync session
        self._rate_limiter.reset()
        self._rate_limit_logged = False

        from app.services.sync import SyncService

        sync_service = SyncService(db, self)
        try:
            items_synced = await sync_service.sync_recent(since)
        except RateLimitExceeded as e:
            errors.append(f"Rate limit exceeded: {e}")
            logger.error(f"Sync stopped due to rate limit: {e}")
        except Exception as e:
            errors.append(str(e))

        # Log rate limiter stats
        stats = self._rate_limiter.get_stats()
        logger.info(
            f"Sync complete. API calls: {stats['calls_made']}/{stats['max_per_sync']}"
        )

        return SyncResult(
            connector_name=self.name,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            items_synced=items_synced,
            errors=errors,
        )

    async def close(self):
        await self._client.aclose()
