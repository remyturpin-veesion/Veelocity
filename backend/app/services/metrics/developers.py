"""Developer statistics service."""

from datetime import datetime
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github import Commit, PRComment, PRReview, PullRequest


class DeveloperStatsService:
    """Calculate per-developer statistics."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_all_developers(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        repo_id: int | None = None,
    ) -> list[dict]:
        """
        Get list of all developers with basic stats.

        Developers are identified by their GitHub login from PRs, reviews, and comments.
        """
        # Get unique logins from PRs
        pr_authors = select(
            PullRequest.author_login.label("login"),
            PullRequest.author_avatar.label("avatar"),
        ).distinct()

        if repo_id:
            pr_authors = pr_authors.where(PullRequest.repo_id == repo_id)
        if start_date:
            pr_authors = pr_authors.where(PullRequest.created_at >= start_date)
        if end_date:
            pr_authors = pr_authors.where(PullRequest.created_at <= end_date)

        result = await self._db.execute(pr_authors)
        developers_map = {row.login: row.avatar for row in result.all()}

        # Get stats for each developer
        developers = []
        for login, avatar in developers_map.items():
            stats = await self.get_developer_stats(login, start_date, end_date, repo_id)
            developers.append(
                {
                    "login": login,
                    "avatar": avatar,
                    "prs_created": stats["prs_created"],
                    "prs_merged": stats["prs_merged"],
                    "reviews_given": stats["reviews_given"],
                    "comments_made": stats["comments_made"],
                }
            )

        # Sort by total contributions
        developers.sort(
            key=lambda d: d["prs_created"] + d["reviews_given"],
            reverse=True,
        )
        return developers

    async def get_developer_stats(
        self,
        login: str,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        repo_id: int | None = None,
    ) -> dict:
        """Get detailed statistics for a specific developer."""

        # Base filters
        def pr_filters(query):
            q = query.where(PullRequest.author_login == login)
            if repo_id:
                q = q.where(PullRequest.repo_id == repo_id)
            if start_date:
                q = q.where(PullRequest.created_at >= start_date)
            if end_date:
                q = q.where(PullRequest.created_at <= end_date)
            return q

        # PRs created
        prs_created_q = pr_filters(select(func.count(PullRequest.id)))
        result = await self._db.execute(prs_created_q)
        prs_created = result.scalar() or 0

        # PRs merged
        prs_merged_q = pr_filters(
            select(func.count(PullRequest.id)).where(PullRequest.merged_at.isnot(None))
        )
        result = await self._db.execute(prs_merged_q)
        prs_merged = result.scalar() or 0

        # PRs open
        prs_open_q = pr_filters(
            select(func.count(PullRequest.id)).where(
                and_(
                    PullRequest.state == "open",
                    PullRequest.merged_at.is_(None),
                )
            )
        )
        result = await self._db.execute(prs_open_q)
        prs_open = result.scalar() or 0

        # Lines changed (additions + deletions)
        lines_q = pr_filters(
            select(
                func.sum(PullRequest.additions).label("additions"),
                func.sum(PullRequest.deletions).label("deletions"),
            )
        )
        result = await self._db.execute(lines_q)
        row = result.one()
        total_additions = row.additions or 0
        total_deletions = row.deletions or 0

        # Average lines per PR
        avg_lines = (
            (total_additions + total_deletions) / prs_created if prs_created > 0 else 0
        )

        # Average time to merge
        merge_time_q = pr_filters(
            select(PullRequest.created_at, PullRequest.merged_at).where(
                PullRequest.merged_at.isnot(None)
            )
        )
        result = await self._db.execute(merge_time_q)
        merge_times = []
        for row in result.all():
            if row.merged_at and row.created_at:
                delta = (row.merged_at - row.created_at).total_seconds() / 3600
                merge_times.append(delta)

        avg_merge_hours = sum(merge_times) / len(merge_times) if merge_times else 0

        # Reviews given
        reviews_q = select(func.count(PRReview.id)).where(
            PRReview.reviewer_login == login
        )
        if start_date:
            reviews_q = reviews_q.where(PRReview.submitted_at >= start_date)
        if end_date:
            reviews_q = reviews_q.where(PRReview.submitted_at <= end_date)
        result = await self._db.execute(reviews_q)
        reviews_given = result.scalar() or 0

        # Comments made
        comments_q = select(func.count(PRComment.id)).where(
            PRComment.author_login == login
        )
        if start_date:
            comments_q = comments_q.where(PRComment.created_at >= start_date)
        if end_date:
            comments_q = comments_q.where(PRComment.created_at <= end_date)
        result = await self._db.execute(comments_q)
        comments_made = result.scalar() or 0

        # Commits made
        commits_q = select(func.count(Commit.id)).where(Commit.author_login == login)
        if repo_id:
            commits_q = commits_q.where(Commit.repo_id == repo_id)
        if start_date:
            commits_q = commits_q.where(Commit.committed_at >= start_date)
        if end_date:
            commits_q = commits_q.where(Commit.committed_at <= end_date)
        result = await self._db.execute(commits_q)
        commits_made = result.scalar() or 0

        return {
            "login": login,
            "prs_created": prs_created,
            "prs_merged": prs_merged,
            "prs_open": prs_open,
            "total_additions": total_additions,
            "total_deletions": total_deletions,
            "avg_lines_per_pr": round(avg_lines, 1),
            "avg_merge_hours": round(avg_merge_hours, 2),
            "reviews_given": reviews_given,
            "comments_made": comments_made,
            "commits_made": commits_made,
        }

    async def get_leaderboard(
        self,
        metric: Literal[
            "prs_created", "prs_merged", "reviews_given", "comments_made", "commits"
        ] = "prs_merged",
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        repo_id: int | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """Get developers ranked by a specific metric."""
        developers = await self.get_all_developers(start_date, end_date, repo_id)

        # Map metric names to dict keys
        metric_key = metric if metric != "commits" else "commits_made"

        # For metrics not in basic stats, fetch full stats
        if metric in ("commits",):
            for dev in developers:
                full_stats = await self.get_developer_stats(
                    dev["login"], start_date, end_date, repo_id
                )
                dev["commits_made"] = full_stats["commits_made"]

        # Sort and limit
        developers.sort(key=lambda d: d.get(metric_key, 0), reverse=True)
        return developers[:limit]
