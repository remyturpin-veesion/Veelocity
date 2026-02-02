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

from app.models.linear import LinearIssue, LinearWorkflowState


class LinearMetricsService:
    """Calculate Linear-native metrics from synced issues."""

    def __init__(self, db: AsyncSession):
        self._db = db

    def _team_filter(self, team_id: int | None, team_ids: list[int] | None):
        """Resolve team filter: team_ids if non-empty, else single team_id, else None."""
        if team_ids:
            return list(team_ids)
        if team_id is not None:
            return [team_id]
        return None

    async def get_issues_completed(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        team_id: int | None = None,
        team_ids: list[int] | None = None,
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
        ids = self._team_filter(team_id, team_ids)
        if ids:
            query = query.where(LinearIssue.team_id.in_(ids))

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
        team_ids: list[int] | None = None,
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
        ids = self._team_filter(team_id, team_ids)
        if ids:
            query = query.where(LinearIssue.team_id.in_(ids))

        result = await self._db.execute(query)
        count = result.scalar() or 0

        return {"backlog_count": count}

    async def _get_ordered_workflow_states(
        self, team_ids: list[int] | None
    ) -> list[tuple[str, float, str | None]]:
        """Return workflow state (name, position, type) ordered by position, deduplicated by name."""
        q = select(
            LinearWorkflowState.name,
            LinearWorkflowState.position,
            LinearWorkflowState.type,
        )
        if team_ids:
            q = q.where(LinearWorkflowState.team_id.in_(team_ids))
        q = q.order_by(LinearWorkflowState.team_id, LinearWorkflowState.position)
        result = await self._db.execute(q)
        rows = result.all()
        seen: set[str] = set()
        order: list[tuple[str, float, str | None]] = []
        for name, pos, typ in rows:
            if name not in seen:
                seen.add(name)
                order.append((name, float(pos), typ))
        return sorted(order, key=lambda x: x[1])

    async def get_time_in_state(
        self,
        start_date: datetime,
        end_date: datetime,
        team_id: int | None = None,
        team_ids: list[int] | None = None,
    ) -> dict:
        """
        Return one card per workflow state (Todo, In Progress, etc.) in order.
        Each card has: count, median, min, max, average (time in that status).
        Time stats use issues with completed_at in the date range. The "started" state
        (e.g. In Progress) is filled from started_at→completed_at; other states need
        Linear issue history to be non-zero.
        """
        ids = self._team_filter(team_id, team_ids)

        ordered_states = await self._get_ordered_workflow_states(ids)

        # Issue counts per state (current state, filtered by team)
        count_q = select(LinearIssue.state, func.count(LinearIssue.id))
        if ids:
            count_q = count_q.where(LinearIssue.team_id.in_(ids))
        count_q = count_q.group_by(LinearIssue.state)
        count_result = await self._db.execute(count_q)
        counts_by_state = {row[0]: row[1] for row in count_result.all()}

        # Hours in "started" state for issues completed in the date range
        started_q = (
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
        if ids:
            started_q = started_q.where(LinearIssue.team_id.in_(ids))
        started_result = await self._db.execute(started_q)
        started_hours: list[float] = []
        for started_at, completed_at in started_result.all():
            if started_at and completed_at:
                started_hours.append(
                    round((completed_at - started_at).total_seconds() / 3600, 2)
                )

        def slug(s: str) -> str:
            return s.lower().replace(" ", "_").replace("-", "_")

        def stats(hours: list[float]) -> dict:
            if not hours:
                return {
                    "count": 0,
                    "min_hours": 0.0,
                    "max_hours": 0.0,
                    "median_hours": 0.0,
                    "average_hours": 0.0,
                }
            sorted_h = sorted(hours)
            n = len(sorted_h)
            return {
                "count": n,
                "min_hours": round(min(hours), 2),
                "max_hours": round(max(hours), 2),
                "median_hours": round(sorted_h[n // 2], 2),
                "average_hours": round(sum(hours) / n, 2),
            }

        started_stats = stats(started_hours)

        # Only the "In Progress" / "Started" state gets time stats: we measure started_at →
        # completed_at. Linear's type "started" can apply to many states (In Review, Merged, etc.),
        # so we key off state name only and assign global started_stats to at most one stage.
        _STARTED_STATE_NAMES = frozenset({"in progress", "started"})

        stages = []
        started_stats_assigned = False
        for name, position, state_type in ordered_states:
            is_in_progress_by_name = name.strip().lower() in _STARTED_STATE_NAMES
            if is_in_progress_by_name and not started_stats_assigned:
                st = started_stats
                count = st["count"]
                started_stats_assigned = True
            else:
                count = counts_by_state.get(name, 0)
                st = {
                    "count": 0,
                    "min_hours": 0.0,
                    "max_hours": 0.0,
                    "median_hours": 0.0,
                    "average_hours": 0.0,
                }
            stages.append({
                "id": slug(name),
                "label": name,
                "position": position,
                "count": count,
                "min_hours": st["min_hours"],
                "max_hours": st["max_hours"],
                "median_hours": st["median_hours"],
                "average_hours": st["average_hours"],
            })

        # If no workflow states synced yet, fall back to distinct issue states (unordered)
        if not stages:
            for state_name in sorted(counts_by_state.keys()):
                stages.append({
                    "id": slug(state_name),
                    "label": state_name,
                    "position": 0.0,
                    "count": counts_by_state[state_name],
                    "min_hours": 0.0,
                    "max_hours": 0.0,
                    "median_hours": 0.0,
                    "average_hours": 0.0,
                })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": started_stats["count"],
            "average_hours": started_stats["average_hours"],
            "median_hours": started_stats["median_hours"],
            "min_hours": started_stats["min_hours"],
            "max_hours": started_stats["max_hours"],
            "stages": stages,
        }

    async def get_overview(
        self,
        start_date: datetime,
        end_date: datetime,
        team_id: int | None = None,
        team_ids: list[int] | None = None,
    ) -> dict:
        """
        Single response for dashboard: issues completed, backlog, time-in-state.
        """
        issues_completed = await self.get_issues_completed(
            start_date, end_date, period="week", team_id=team_id, team_ids=team_ids
        )
        backlog = await self.get_backlog(team_id=team_id, team_ids=team_ids)
        time_in_state = await self.get_time_in_state(
            start_date, end_date, team_id=team_id, team_ids=team_ids
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
