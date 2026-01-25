import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.github import GitHubConnector
from app.models.github import Commit, PRComment, PRReview, PullRequest, Repository
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)


def _parse_datetime(value: str | datetime | None) -> datetime | None:
    """Parse datetime string to naive datetime (removes timezone info)."""
    if value is None:
        return None
    if isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        dt = value
    # Convert to naive datetime (remove tzinfo) for TIMESTAMP WITHOUT TIME ZONE
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class SyncService:
    """Orchestrates data sync from connectors to database."""

    def __init__(self, db: AsyncSession, connector: GitHubConnector):
        self._db = db
        self._connector = connector
        self._sync_state = SyncStateService(db)

    async def sync_all(self) -> int:
        """Full sync: repos, PRs, reviews, comments, commits."""
        count = 0
        repos = await self._connector.fetch_repos()
        count += await self._upsert_repos(repos)

        for repo_data in repos:
            repo = await self._get_repo_by_github_id(repo_data["github_id"])
            if not repo:
                continue

            prs = await self._connector.fetch_pull_requests(repo_data["full_name"], state="all")
            count += await self._upsert_prs(repo.id, prs)

            for pr_data in prs:
                pr = await self._get_pr_by_github_id(pr_data["github_id"])
                if not pr:
                    continue

                reviews = await self._connector.fetch_reviews(repo_data["full_name"], pr_data["number"])
                count += await self._upsert_reviews(pr.id, reviews)

                comments = await self._connector.fetch_comments(repo_data["full_name"], pr_data["number"])
                count += await self._upsert_comments(pr.id, comments)

                commits = await self._connector.fetch_pr_commits(repo_data["full_name"], pr_data["number"])
                count += await self._upsert_commits(repo.id, pr.id, commits)

        # Update sync state
        await self._sync_state.update_last_full_sync(self._connector.name)
        await self._db.commit()
        
        logger.info(f"Full sync complete: {count} items")
        return count

    async def sync_recent(self, since: datetime | None = None) -> int:
        """
        Incremental sync: only fetch PRs updated since last sync.
        
        If since is not provided, uses last_sync_at from database.
        Falls back to full sync if no previous sync exists.
        """
        # Get last sync time if not provided
        if since is None:
            since = await self._sync_state.get_last_sync(self._connector.name)
        
        # If no previous sync, do full sync
        if since is None:
            logger.info("No previous sync found, performing full sync")
            return await self.sync_all()
        
        logger.info(f"Incremental sync since {since}")
        
        count = 0
        repos = await self._connector.fetch_repos()
        count += await self._upsert_repos(repos)

        for repo_data in repos:
            repo = await self._get_repo_by_github_id(repo_data["github_id"])
            if not repo:
                continue

            # Fetch only PRs updated since last sync
            prs = await self._connector.fetch_pull_requests(
                repo_data["full_name"], state="all", since=since
            )
            
            if not prs:
                logger.debug(f"No updated PRs in {repo_data['full_name']}")
                continue
                
            logger.info(f"Found {len(prs)} updated PRs in {repo_data['full_name']}")
            count += await self._upsert_prs(repo.id, prs)

            # Only fetch reviews/comments/commits for updated PRs
            for pr_data in prs:
                pr = await self._get_pr_by_github_id(pr_data["github_id"])
                if not pr:
                    continue

                reviews = await self._connector.fetch_reviews(repo_data["full_name"], pr_data["number"])
                count += await self._upsert_reviews(pr.id, reviews)

                comments = await self._connector.fetch_comments(repo_data["full_name"], pr_data["number"])
                count += await self._upsert_comments(pr.id, comments)

                commits = await self._connector.fetch_pr_commits(repo_data["full_name"], pr_data["number"])
                count += await self._upsert_commits(repo.id, pr.id, commits)

        # Update sync state
        await self._sync_state.update_last_sync(self._connector.name)
        await self._db.commit()
        
        logger.info(f"Incremental sync complete: {count} items")
        return count

    async def _upsert_repos(self, repos: list[dict]) -> int:
        count = 0
        for data in repos:
            result = await self._db.execute(
                select(Repository).where(Repository.github_id == data["github_id"])
            )
            repo = result.scalar_one_or_none()
            if repo:
                repo.name = data["name"]
                repo.full_name = data["full_name"]
                repo.default_branch = data["default_branch"]
            else:
                repo = Repository(**data)
                self._db.add(repo)
            count += 1
        await self._db.flush()
        return count

    async def _upsert_prs(self, repo_id: int, prs: list[dict]) -> int:
        count = 0
        for data in prs:
            result = await self._db.execute(
                select(PullRequest).where(PullRequest.github_id == data["github_id"])
            )
            pr = result.scalar_one_or_none()
            pr_data = {**data, "repo_id": repo_id}
            # Parse datetime strings to naive datetime
            for field in ("created_at", "updated_at", "merged_at", "closed_at"):
                pr_data[field] = _parse_datetime(pr_data.get(field))
            if pr:
                for key, value in pr_data.items():
                    if key != "github_id":
                        setattr(pr, key, value)
            else:
                pr = PullRequest(**pr_data)
                self._db.add(pr)
            count += 1
        await self._db.flush()
        return count

    async def _upsert_reviews(self, pr_id: int, reviews: list[dict]) -> int:
        count = 0
        for data in reviews:
            result = await self._db.execute(
                select(PRReview).where(PRReview.github_id == data["github_id"])
            )
            existing = result.scalar_one_or_none()
            review_data = {**data, "pr_id": pr_id}
            review_data["submitted_at"] = _parse_datetime(review_data.get("submitted_at"))
            if existing:
                # Update existing review (state can change: PENDING -> APPROVED, etc.)
                for key, value in review_data.items():
                    if key != "github_id":
                        setattr(existing, key, value)
            else:
                self._db.add(PRReview(**review_data))
            count += 1
        await self._db.flush()
        return count

    async def _upsert_comments(self, pr_id: int, comments: list[dict]) -> int:
        count = 0
        for data in comments:
            result = await self._db.execute(
                select(PRComment).where(PRComment.github_id == data["github_id"])
            )
            existing = result.scalar_one_or_none()
            comment_data = {**data, "pr_id": pr_id}
            comment_data["created_at"] = _parse_datetime(comment_data.get("created_at"))
            if existing:
                # Update existing comment (body can be edited on GitHub)
                for key, value in comment_data.items():
                    if key != "github_id":
                        setattr(existing, key, value)
            else:
                self._db.add(PRComment(**comment_data))
            count += 1
        await self._db.flush()
        return count

    async def _upsert_commits(self, repo_id: int, pr_id: int, commits: list[dict]) -> int:
        count = 0
        for data in commits:
            result = await self._db.execute(
                select(Commit).where(Commit.sha == data["sha"])
            )
            existing = result.scalar_one_or_none()
            commit_data = {
                "sha": data["sha"],
                "repo_id": repo_id,
                "pr_id": pr_id,
                "author_login": data["author_login"],
                "message": data["message"],
                "committed_at": _parse_datetime(data.get("committed_at")),
            }
            if not existing:
                self._db.add(Commit(**commit_data))
                count += 1
        await self._db.flush()
        return count

    async def _get_repo_by_github_id(self, github_id: int) -> Repository | None:
        result = await self._db.execute(
            select(Repository).where(Repository.github_id == github_id)
        )
        return result.scalar_one_or_none()

    async def _get_pr_by_github_id(self, github_id: int) -> PullRequest | None:
        result = await self._db.execute(
            select(PullRequest).where(PullRequest.github_id == github_id)
        )
        return result.scalar_one_or_none()