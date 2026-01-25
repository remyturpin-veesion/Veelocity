from datetime import datetime, timezone

import httpx

from app.connectors.base import BaseConnector
from app.schemas.connector import SyncResult


class GitHubConnector(BaseConnector):
    """Connector for GitHub REST API."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str, repos: list[str]):
        self._token = token
        self._repos = repos
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            timeout=30.0,
        )

    @property
    def name(self) -> str:
        return "github"

    def get_supported_metrics(self) -> list[str]:
        return ["pr_review_time", "pr_merge_time", "throughput"]

    async def test_connection(self) -> bool:
        response = await self._client.get("/user")
        return response.status_code == 200

    async def fetch_repos(self) -> list[dict]:
        repos = []
        for repo_full_name in self._repos:
            response = await self._client.get(f"/repos/{repo_full_name}")
            if response.status_code == 200:
                data = response.json()
                repos.append({
                    "github_id": data["id"],
                    "name": data["name"],
                    "full_name": data["full_name"],
                    "default_branch": data.get("default_branch", "main"),
                })
        return repos

    async def fetch_pull_requests(
        self,
        repo_full_name: str,
        state: str = "all",
        per_page: int = 100,
        since: datetime | None = None,
    ) -> list[dict]:
        """
        Fetch pull requests from a repository.
        
        Args:
            repo_full_name: Repository full name (owner/repo)
            state: PR state filter (all, open, closed)
            per_page: Results per page
            since: Only fetch PRs updated after this datetime (incremental sync)
        """
        prs = []
        page = 1
        
        while True:
            params = {"state": state, "per_page": per_page, "page": page, "sort": "updated", "direction": "desc"}
            
            response = await self._client.get(
                f"/repos/{repo_full_name}/pulls",
                params=params,
            )
            if response.status_code != 200:
                break
            data = response.json()
            if not data:
                break
            
            # Track if we've passed the since threshold
            found_old_pr = False
            
            for pr in data:
                pr_updated_at = pr["updated_at"]
                
                # If we have a since filter, check if this PR is older
                if since:
                    from datetime import datetime as dt
                    updated = dt.fromisoformat(pr_updated_at.replace("Z", "+00:00"))
                    if since.tzinfo is None:
                        since_aware = since.replace(tzinfo=updated.tzinfo)
                    else:
                        since_aware = since
                    
                    if updated < since_aware:
                        found_old_pr = True
                        continue  # Skip PRs not updated since last sync
                
                prs.append({
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
                })
            
            # If we found an old PR and have since filter, stop paginating
            if found_old_pr and since:
                break
            
            page += 1
            
            # Safety limit to avoid infinite loops
            if page > 50:
                break
                
        return prs

    async def fetch_reviews(self, repo_full_name: str, pr_number: int) -> list[dict]:
        response = await self._client.get(
            f"/repos/{repo_full_name}/pulls/{pr_number}/reviews"
        )
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
        response = await self._client.get(
            f"/repos/{repo_full_name}/pulls/{pr_number}/comments"
        )
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
        response = await self._client.get(
            f"/repos/{repo_full_name}/pulls/{pr_number}/commits"
        )
        if response.status_code != 200:
            return []
        return [
            {
                "sha": commit["sha"],
                "author_login": commit.get("author", {}).get("login", commit["commit"]["author"]["name"]),
                "message": commit["commit"]["message"],
                "committed_at": commit["commit"]["author"]["date"],
            }
            for commit in response.json()
        ]

    async def sync_all(self, db) -> SyncResult:
        started_at = datetime.now(timezone.utc)
        items_synced = 0
        errors = []
        from app.services.sync import SyncService
        sync_service = SyncService(db, self)
        try:
            items_synced = await sync_service.sync_all()
        except Exception as e:
            errors.append(str(e))
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
        from app.services.sync import SyncService
        sync_service = SyncService(db, self)
        try:
            items_synced = await sync_service.sync_recent(since)
        except Exception as e:
            errors.append(str(e))
        return SyncResult(
            connector_name=self.name,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            items_synced=items_synced,
            errors=errors,
        )

    async def close(self):
        await self._client.aclose()
