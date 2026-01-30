"""Linear-native metrics: issues completed, backlog, time-in-state.

Backlog: issues where completed_at and canceled_at are both null (open).
Closed states in Linear are typically "Done" and "Canceled"; we use
completed_at/canceled_at for consistency across workspaces.
"""

from collections import Counter
from datetime import datetime
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.linear import LinearIssue


class LinearMetricsService:
    """Calculate Linear-native metrics from synced issues."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_issues_completed(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        team_id: int | None = None,
    ) -> dict:
        """
        Count of issues with completed_at in the period, grouped by period.
        """
        query = select(LinearIssue.completed_at).where(
            and_(
                LinearIssue.completed_at >= start_date,
                LinearIssue.completed_at <= end_date,
                LinearIssue.completed_at.isnot(None),
            )
        )
        if team_id is not None:
            query = query.where(LinearIssue.team_id == team_id)

        result = await self._db.execute(query)
        dates = [row[0] for row in result.all() if row[0]]

        grouped = self._group_by_period(dates, period)
        total = len(dates)
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

    async def get_backlog(
        self,
        team_id: int | None = None,
    ) -> dict:
        """
        Count of open issues (completed_at and canceled_at both null).
        """
        query = select(func.count(LinearIssue.id)).where(
            and_(
                LinearIssue.completed_at.is_(None),
                LinearIssue.canceled_at.is_(None),
            )
        )
        if team_id is not None:
            query = query.where(LinearIssue.team_id == team_id)

        result = await self._db.execute(query)
        count = result.scalar() or 0

        return {"backlog_count": count}

    async def get_time_in_state(
        self,
        start_date: datetime,
        end_date: datetime,
        team_id: int | None = None,
    ) -> dict:
        """
        For completed issues: time from started_at to completed_at.
        Report average and median in hours.
        """
        query = (
            select(LinearIssue.started_at, LinearIssue.completed_at)
            .where(
                and_(
                    LinearIssue.started_at.isnot(None),
                    LinearIssue.completed_at.isnot(None),
                    LinearIssue.completed_at >= start_date,
                    LinearIssue.completed_at <= end_date,
                )
            )
        )
        if team_id is not None:
            query = query.where(LinearIssue.team_id == team_id)

        result = await self._db.execute(query)
        rows = result.all()

        times_hours = []
        for started_at, completed_at in rows:
            if started_at and completed_at:
                delta = (completed_at - started_at).total_seconds()
                times_hours.append(round(delta / 3600, 2))

        if times_hours:
            avg_hours = sum(times_hours) / len(times_hours)
            sorted_times = sorted(times_hours)
            median_hours = sorted_times[len(sorted_times) // 2]
        else:
            avg_hours = 0.0
            median_hours = 0.0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": len(times_hours),
            "average_hours": round(avg_hours, 2),
            "median_hours": round(median_hours, 2),
        }

    async def get_overview(
        self,
        start_date: datetime,
        end_date: datetime,
        team_id: int | None = None,
    ) -> dict:
        """
        Single response for dashboard: issues completed, backlog, time-in-state.
        """
        issues_completed = await self.get_issues_completed(
            start_date, end_date, period="week", team_id=team_id
        )
        backlog = await self.get_backlog(team_id=team_id)
        time_in_state = await self.get_time_in_state(
            start_date, end_date, team_id=team_id
        )

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "issues_completed": issues_completed["total"],
            "issues_completed_per_week": issues_completed["average"],
            "backlog_count": backlog["backlog_count"],
            "time_in_state_average_hours": time_in_state["average_hours"],
            "time_in_state_median_hours": time_in_state["median_hours"],
            "time_in_state_count": time_in_state["count"],
        }

    def _group_by_period(
        self, dates: list[datetime], period: Literal["day", "week", "month"]
    ) -> list[dict]:
        def get_period_key(dt: datetime) -> str:
            if period == "day":
                return dt.strftime("%Y-%m-%d")
            elif period == "week":
                return dt.strftime("%Y-W%W")
            else:
                return dt.strftime("%Y-%m")

        counts = Counter(get_period_key(dt) for dt in dates if dt)
        return [{"period": k, "count": v} for k, v in sorted(counts.items())]

    def _count_periods(
        self, start: datetime, end: datetime, period: Literal["day", "week", "month"]
    ) -> int:
        delta = end - start
        if period == "day":
            return max(1, delta.days)
        elif period == "week":
            return max(1, delta.days // 7)
        else:
            return max(1, delta.days // 30)
