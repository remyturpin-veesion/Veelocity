"""Development metrics calculation service."""

from collections import Counter
from datetime import datetime
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github import PRReview, PullRequest
from app.models.linear import LinearIssue


def _repo_filter(repo_id: int | None, repo_ids: list[int] | None) -> list[int] | None:
    """Resolve repo filter: repo_ids if provided, else [repo_id] if repo_id, else None."""
    if repo_ids is not None:
        return repo_ids
    if repo_id is not None:
        return [repo_id]
    return None


class DevelopmentMetricsService:
    """Calculate development metrics from synced data."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_pr_review_time(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
        author_login: str | None = None,
        author_logins: list[str] | None = None,
    ) -> dict:
        """
        Calculate PR review time.

        Review time = time from PR opened to first review.
        """
        # Get PRs with their first review
        query = (
            select(
                PullRequest.id,
                PullRequest.created_at.label("pr_created"),
                func.min(PRReview.submitted_at).label("first_review"),
            )
            .join(PRReview, PRReview.pr_id == PullRequest.id)
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
            .group_by(PullRequest.id, PullRequest.created_at)
        )

        repo_filter = _repo_filter(repo_id, repo_ids)
        if repo_filter is not None:
            query = query.where(PullRequest.repo_id.in_(repo_filter))

        authors = (
            author_logins
            if author_logins is not None
            else ([author_login] if author_login else None)
        )
        if authors:
            query = query.where(PullRequest.author_login.in_(authors))

        result = await self._db.execute(query)
        rows = result.all()

        review_times = []
        for row in rows:
            if row.first_review and row.pr_created:
                delta = (row.first_review - row.pr_created).total_seconds()
                review_times.append(
                    {
                        "pr_id": row.id,
                        "hours": round(delta / 3600, 2),
                    }
                )

        # Calculate statistics
        if review_times:
            times = [rt["hours"] for rt in review_times]
            avg_hours = sum(times) / len(times)
            sorted_times = sorted(times)
            median_hours = sorted_times[len(sorted_times) // 2]
        else:
            avg_hours = 0
            median_hours = 0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": len(review_times),
            "average_hours": round(avg_hours, 2),
            "median_hours": round(median_hours, 2),
        }

    async def get_pr_merge_time(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
        author_login: str | None = None,
        author_logins: list[str] | None = None,
    ) -> dict:
        """
        Calculate PR merge time.

        Merge time = time from PR opened to merged.
        """
        query = select(PullRequest).where(
            and_(
                PullRequest.created_at >= start_date,
                PullRequest.created_at <= end_date,
                PullRequest.merged_at.isnot(None),
            )
        )

        repo_filter = _repo_filter(repo_id, repo_ids)
        if repo_filter is not None:
            query = query.where(PullRequest.repo_id.in_(repo_filter))

        authors = (
            author_logins
            if author_logins is not None
            else ([author_login] if author_login else None)
        )
        if authors:
            query = query.where(PullRequest.author_login.in_(authors))

        result = await self._db.execute(query)
        prs = result.scalars().all()

        merge_times = []
        for pr in prs:
            if pr.merged_at and pr.created_at:
                delta = (pr.merged_at - pr.created_at).total_seconds()
                merge_times.append(
                    {
                        "pr_id": pr.id,
                        "hours": round(delta / 3600, 2),
                    }
                )

        # Calculate statistics
        if merge_times:
            times = [mt["hours"] for mt in merge_times]
            avg_hours = sum(times) / len(times)
            sorted_times = sorted(times)
            median_hours = sorted_times[len(sorted_times) // 2]
        else:
            avg_hours = 0
            median_hours = 0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": len(merge_times),
            "average_hours": round(avg_hours, 2),
            "median_hours": round(median_hours, 2),
        }

    async def get_cycle_time(
        self,
        start_date: datetime,
        end_date: datetime,
        team_id: int | None = None,
        include_breakdown: bool = False,
    ) -> dict:
        """
        Calculate cycle time.

        Cycle time = time from issue started to linked PR merged.
        If include_breakdown is True, adds an "issues" list with per-issue details.
        """
        query = (
            select(LinearIssue, PullRequest.merged_at)
            .join(PullRequest, LinearIssue.linked_pr_id == PullRequest.id)
            .where(
                and_(
                    LinearIssue.started_at.isnot(None),
                    PullRequest.merged_at.isnot(None),
                    PullRequest.merged_at >= start_date,
                    PullRequest.merged_at <= end_date,
                )
            )
        )

        if team_id:
            query = query.where(LinearIssue.team_id == team_id)

        result = await self._db.execute(query)
        rows = result.all()

        cycle_times = []
        for issue, merged_at in rows:
            if issue.started_at and merged_at:
                delta = (merged_at - issue.started_at).total_seconds()
                hours = round(delta / 3600, 2)
                cycle_times.append(
                    {
                        "issue_id": issue.id,
                        "identifier": issue.identifier,
                        "hours": hours,
                    }
                )
                if include_breakdown:
                    # Add display fields for breakdown table
                    cycle_times[-1]["title"] = issue.title or ""
                    cycle_times[-1]["url"] = issue.url
                    cycle_times[-1]["started_at"] = (
                        issue.started_at.isoformat() if issue.started_at else None
                    )
                    cycle_times[-1]["merged_at"] = (
                        merged_at.isoformat() if merged_at else None
                    )

        # Calculate statistics
        if cycle_times:
            times = [ct["hours"] for ct in cycle_times]
            avg_hours = sum(times) / len(times)
            sorted_times = sorted(times)
            median_hours = sorted_times[len(sorted_times) // 2]
        else:
            avg_hours = 0
            median_hours = 0

        out = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": len(cycle_times),
            "average_hours": round(avg_hours, 2),
            "median_hours": round(median_hours, 2),
        }
        if include_breakdown:
            out["issues"] = cycle_times
        return out

    async def get_cycle_time_by_period(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        team_id: int | None = None,
    ) -> list[dict]:
        """
        Cycle time median per period (for charts).

        Returns list of {"period": str, "median_hours": float} sorted by period.
        """
        query = (
            select(LinearIssue.started_at, PullRequest.merged_at)
            .join(PullRequest, LinearIssue.linked_pr_id == PullRequest.id)
            .where(
                and_(
                    LinearIssue.started_at.isnot(None),
                    PullRequest.merged_at.isnot(None),
                    PullRequest.merged_at >= start_date,
                    PullRequest.merged_at <= end_date,
                )
            )
        )
        if team_id:
            query = query.where(LinearIssue.team_id == team_id)

        result = await self._db.execute(query)
        rows = result.all()

        def get_period_key(dt: datetime | None) -> str:
            if not dt:
                return ""
            if period == "day":
                return dt.strftime("%Y-%m-%d")
            if period == "week":
                return dt.strftime("%Y-W%W")
            return dt.strftime("%Y-%m")

        by_period: dict[str, list[float]] = {}
        for started_at, merged_at in rows:
            if not started_at or not merged_at:
                continue
            key = get_period_key(merged_at)
            if not key:
                continue
            hours = (merged_at - started_at).total_seconds() / 3600
            by_period.setdefault(key, []).append(round(hours, 2))

        out = []
        for key in sorted(by_period.keys()):
            times = sorted(by_period[key])
            median = times[len(times) // 2] if times else 0.0
            out.append({"period": key, "median_hours": median})
        return out

    async def get_throughput(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
        author_login: str | None = None,
        author_logins: list[str] | None = None,
    ) -> dict:
        """
        Calculate throughput.

        Throughput = count of PRs merged per period.
        """
        query = select(PullRequest.merged_at).where(
            and_(
                PullRequest.merged_at >= start_date,
                PullRequest.merged_at <= end_date,
                PullRequest.merged_at.isnot(None),
            )
        )

        repo_filter = _repo_filter(repo_id, repo_ids)
        if repo_filter is not None:
            query = query.where(PullRequest.repo_id.in_(repo_filter))

        authors = (
            author_logins
            if author_logins is not None
            else ([author_login] if author_login else None)
        )
        if authors:
            query = query.where(PullRequest.author_login.in_(authors))

        result = await self._db.execute(query)
        merged_dates = [row[0] for row in result.all() if row[0]]

        # Group by period
        grouped = self._group_by_period(merged_dates, period)

        # Calculate average
        total = len(merged_dates)
        period_count = self._count_periods(start_date, end_date, period)
        average = total / period_count if period_count > 0 else 0

        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "data": grouped,
            "total": total,
            "average": round(average, 2),
        }

    def _group_by_period(
        self, dates: list[datetime], period: Literal["day", "week", "month"]
    ) -> list[dict]:
        """Group dates by period and count."""

        def get_period_key(dt: datetime) -> str:
            if period == "day":
                return dt.strftime("%Y-%m-%d")
            elif period == "week":
                return dt.strftime("%Y-W%W")
            else:  # month
                return dt.strftime("%Y-%m")

        counts = Counter(get_period_key(dt) for dt in dates if dt)
        return [{"period": k, "count": v} for k, v in sorted(counts.items())]

    def _count_periods(
        self, start: datetime, end: datetime, period: Literal["day", "week", "month"]
    ) -> int:
        """Count number of periods between two dates."""
        delta = end - start
        if period == "day":
            return max(1, delta.days)
        elif period == "week":
            return max(1, delta.days // 7)
        else:  # month
            return max(1, delta.days // 30)
