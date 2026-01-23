from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.github import GitHubConnector
from app.models.github import Commit, PRComment, PRReview, PullRequest, Repository


class SyncService:
    """Orchestrates data sync from connectors to database."""

    def __init__(self, db: AsyncSession, connector: GitHubConnector):
        self._db = db
        self._connector = connector

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

        await self._db.commit()
        return count

    async def sync_recent(self, since: datetime) -> int:
        """Incremental sync - same as sync_all but filters by date."""
        # For now, same as sync_all. Future: filter PRs by updated_at > since
        return await self.sync_all()

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
            # Parse datetime strings
            for field in ("created_at", "updated_at", "merged_at", "closed_at"):
                if pr_data.get(field) and isinstance(pr_data[field], str):
                    pr_data[field] = datetime.fromisoformat(pr_data[field].replace("Z", "+00:00"))
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
            if review_data.get("submitted_at") and isinstance(review_data["submitted_at"], str):
                review_data["submitted_at"] = datetime.fromisoformat(review_data["submitted_at"].replace("Z", "+00:00"))
            if not existing:
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
            if comment_data.get("created_at") and isinstance(comment_data["created_at"], str):
                comment_data["created_at"] = datetime.fromisoformat(comment_data["created_at"].replace("Z", "+00:00"))
            if not existing:
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
                "committed_at": datetime.fromisoformat(data["committed_at"].replace("Z", "+00:00")) if isinstance(data["committed_at"], str) else data["committed_at"],
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
