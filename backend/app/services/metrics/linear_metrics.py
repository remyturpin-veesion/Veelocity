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

from app.models.linear import (
    LinearIssue,
    LinearIssueStateTransition,
    LinearTeam,
    LinearWorkflowState,
)


class LinearMetricsService:
    """Calculate Linear-native metrics from synced issues."""

    def __init__(self, db: AsyncSession):
        self._db = db

    def _team_filter(self, team_id: int | None, team_ids: list[int] | None):
        """Resolve team filter: team_ids if provided (including [] = no teams), else single team_id, else None."""
        if team_ids is not None:
            return list(team_ids)
        if team_id is not None:
            return [team_id]
        return None

    async def _get_matching_assignee_names(self, login: str) -> list[str]:
        """Return Linear assignee_name values that match this GitHub login.
        Matches: exact, lowercase no-spaces, and reversed word order
        (e.g. 'ouattararomuald' matches 'Romuald Ouattara').
        """
        if not login or not login.strip():
            return []
        login_norm = login.strip().lower().replace(" ", "")
        result = await self._db.execute(
            select(LinearIssue.assignee_name)
            .where(LinearIssue.assignee_name.isnot(None))
            .distinct()
        )
        matching: list[str] = []
        for (name,) in result.all():
            if not name:
                continue
            name_clean = name.strip().lower()
            name_norm = name_clean.replace(" ", "")
            if login_norm == name_norm or login_norm == name.strip():
                matching.append(name)
                continue
            parts = name_clean.split()
            if len(parts) >= 2:
                reversed_norm = "".join(reversed(parts))
                if login_norm == reversed_norm:
                    matching.append(name)
        return matching

    def _assignee_filter_sync(self, query, matching_assignee_names: list[str] | None):
        """Apply assignee filter: restrict to these assignee_name values (from _get_matching_assignee_names)."""
        if matching_assignee_names is None:
            return query
        if not matching_assignee_names:
            return query.where(LinearIssue.id == -1)
        return query.where(
            LinearIssue.assignee_name.isnot(None),
            LinearIssue.assignee_name.in_(matching_assignee_names),
        )

    async def get_issues_completed(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        team_id: int | None = None,
        team_ids: list[int] | None = None,
        assignee_name: str | None = None,
    ) -> dict:
        """
        Count of issues with completed_at in the period, grouped by period.
        Also returns list of individual completed issues with details.
        """
        ids = self._team_filter(team_id, team_ids)
        matching = (
            await self._get_matching_assignee_names(assignee_name)
            if assignee_name
            else None
        )

        # Query for time-series aggregation (dates only)
        dates_query = select(LinearIssue.completed_at).where(
            and_(
                LinearIssue.completed_at >= start_date,
                LinearIssue.completed_at <= end_date,
                LinearIssue.completed_at.isnot(None),
            )
        )
        if ids is not None:
            dates_query = dates_query.where(LinearIssue.team_id.in_(ids))
        dates_query = self._assignee_filter_sync(dates_query, matching)

        dates_result = await self._db.execute(dates_query)
        dates = [row[0] for row in dates_result.all() if row[0]]

        # Query for issue list with details
        issues_query = (
            select(
                LinearIssue.id,
                LinearIssue.identifier,
                LinearIssue.title,
                LinearIssue.url,
                LinearIssue.assignee_name,
                LinearIssue.project_name,
                LinearIssue.labels,
                LinearIssue.created_at,
                LinearIssue.completed_at,
                LinearTeam.name.label("team_name"),
            )
            .join(LinearTeam, LinearIssue.team_id == LinearTeam.id)
            .where(
                and_(
                    LinearIssue.completed_at >= start_date,
                    LinearIssue.completed_at <= end_date,
                    LinearIssue.completed_at.isnot(None),
                )
            )
            .order_by(LinearIssue.completed_at.desc())
        )
        if ids is not None:
            issues_query = issues_query.where(LinearIssue.team_id.in_(ids))
        issues_query = self._assignee_filter_sync(issues_query, matching)

        issues_result = await self._db.execute(issues_query)
        issues_rows = issues_result.all()

        issues_list = []
        for row in issues_rows:
            lead_time_hours: float | None = None
            if row.created_at and row.completed_at:
                delta = row.completed_at - row.created_at
                lead_time_hours = round(delta.total_seconds() / 3600, 1)
            issues_list.append(
                {
                    "id": row.id,
                    "identifier": row.identifier,
                    "title": row.title,
                    "url": row.url,
                    "assignee_name": row.assignee_name,
                    "project_name": row.project_name,
                    "labels": [s.strip() for s in row.labels.split(",") if s.strip()] if row.labels else [],
                    "team_name": row.team_name,
                    "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                    "lead_time_hours": lead_time_hours,
                }
            )

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
            "issues": issues_list,
        }

    async def get_backlog(
        self,
        team_id: int | None = None,
        team_ids: list[int] | None = None,
        assignee_name: str | None = None,
    ) -> dict:
        """
        Count of open issues (completed_at and canceled_at both null).
        Returns total count and optional by_team breakdown (team_id, team_name, count).
        """
        base_filter = and_(
            LinearIssue.completed_at.is_(None),
            LinearIssue.canceled_at.is_(None),
        )
        ids = self._team_filter(team_id, team_ids)
        matching = (
            await self._get_matching_assignee_names(assignee_name)
            if assignee_name
            else None
        )

        # Total count
        query = select(func.count(LinearIssue.id)).where(base_filter)
        if ids is not None:
            query = query.where(LinearIssue.team_id.in_(ids))
        query = self._assignee_filter_sync(query, matching)
        result = await self._db.execute(query)
        count = result.scalar() or 0

        # By-team breakdown (same filters): team_id, team_name, count
        by_team_q = (
            select(
                LinearIssue.team_id,
                LinearTeam.name.label("team_name"),
                func.count(LinearIssue.id).label("count"),
            )
            .join(LinearTeam, LinearIssue.team_id == LinearTeam.id)
            .where(base_filter)
        )
        if ids is not None:
            by_team_q = by_team_q.where(LinearIssue.team_id.in_(ids))
        by_team_q = self._assignee_filter_sync(by_team_q, matching)
        by_team_q = by_team_q.group_by(LinearIssue.team_id, LinearTeam.name)
        by_team_result = await self._db.execute(by_team_q)
        by_team = [
            {"team_id": row[0], "team_name": row[1], "count": row[2]}
            for row in by_team_result.all()
        ]

        # By-state breakdown (open issues per workflow state, same filters, ordered)
        ordered_states = await self._get_ordered_workflow_states(ids)
        state_count_q = select(
            LinearIssue.state, func.count(LinearIssue.id).label("count")
        ).where(base_filter)
        if ids is not None:
            state_count_q = state_count_q.where(LinearIssue.team_id.in_(ids))
        state_count_q = self._assignee_filter_sync(state_count_q, matching)
        state_count_q = state_count_q.group_by(LinearIssue.state)
        state_count_result = await self._db.execute(state_count_q)
        counts_by_state = {row[0]: row[1] for row in state_count_result.all()}
        by_state = [
            {"state_name": name, "count": counts_by_state.get(name, 0)}
            for name, _position, _typ in ordered_states
        ]
        # If no workflow states synced, fall back to distinct issue states (unordered)
        if not by_state and counts_by_state:
            by_state = [
                {"state_name": s, "count": c}
                for s, c in sorted(counts_by_state.items())
            ]

        return {
            "backlog_count": count,
            "total": count,
            "by_team": by_team,
            "by_state": by_state,
        }

    async def _get_ordered_workflow_states(
        self, team_ids: list[int] | None
    ) -> list[tuple[str, float, str | None]]:
        """Return workflow state (name, position, type) ordered by position, deduplicated by name."""
        q = select(
            LinearWorkflowState.name,
            LinearWorkflowState.position,
            LinearWorkflowState.type,
        )
        if team_ids is not None:
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
        assignee_name: str | None = None,
    ) -> dict:
        """
        Return one card per workflow state (Todo, In Progress, etc.) in order.
        Each card has: count, median, min, max, average (time in that status).
        Time stats use issues with completed_at in the date range. When we have
        synced state transitions (from Linear issue history), we compute time
        per state from transitions; otherwise we fall back to started_at→completed_at
        for the "In Progress" state only.
        """
        ids = self._team_filter(team_id, team_ids)
        ordered_states = await self._get_ordered_workflow_states(ids)
        matching = (
            await self._get_matching_assignee_names(assignee_name)
            if assignee_name
            else None
        )

        # Issue counts per state (current state)
        count_q = select(LinearIssue.state, func.count(LinearIssue.id))
        if ids is not None:
            count_q = count_q.where(LinearIssue.team_id.in_(ids))
        count_q = self._assignee_filter_sync(count_q, matching)
        count_q = count_q.group_by(LinearIssue.state)
        count_result = await self._db.execute(count_q)
        counts_by_state = {row[0]: row[1] for row in count_result.all()}

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

        # Issues completed in the date range (for time-in-state)
        completed_q = select(
            LinearIssue.id, LinearIssue.completed_at, LinearIssue.started_at
        ).where(
            and_(
                LinearIssue.completed_at.isnot(None),
                LinearIssue.completed_at >= start_date,
                LinearIssue.completed_at <= end_date,
            )
        )
        if ids is not None:
            completed_q = completed_q.where(LinearIssue.team_id.in_(ids))
        completed_q = self._assignee_filter_sync(completed_q, matching)
        completed_result = await self._db.execute(completed_q)
        completed_issues = list(completed_result.all())
        completed_ids = [r[0] for r in completed_issues]
        completed_at_by_id = {r[0]: r[1] for r in completed_issues}
        started_at_by_id = {r[0]: r[2] for r in completed_issues}

        # Load all state transitions for these issues in one query
        hours_by_state: dict[str, list[float]] = {}
        if completed_ids:
            trans_q = (
                select(LinearIssueStateTransition)
                .where(LinearIssueStateTransition.linear_issue_id.in_(completed_ids))
                .order_by(
                    LinearIssueStateTransition.linear_issue_id,
                    LinearIssueStateTransition.created_at,
                )
            )
            trans_result = await self._db.execute(trans_q)
            transitions = list(trans_result.scalars().all())
            by_issue: dict[int, list] = {}
            for t in transitions:
                by_issue.setdefault(t.linear_issue_id, []).append(t)
            for issue_id in completed_ids:
                completed_at = completed_at_by_id.get(issue_id)
                if not completed_at:
                    continue
                issue_trans = by_issue.get(issue_id, [])
                for i, t in enumerate(issue_trans):
                    state_name = t.to_state
                    start_ts = t.created_at
                    end_ts = (
                        issue_trans[i + 1].created_at
                        if i + 1 < len(issue_trans)
                        else completed_at
                    )
                    if start_ts and end_ts and end_ts > start_ts:
                        hours = (end_ts - start_ts).total_seconds() / 3600
                        hours_by_state.setdefault(state_name, []).append(
                            round(hours, 2)
                        )

        # Fallback: "In Progress" from started_at→completed_at when no transitions
        _STARTED_STATE_NAMES = frozenset({"in progress", "started"})
        started_hours: list[float] = []
        for issue_id in completed_ids:
            started_at = started_at_by_id.get(issue_id)
            completed_at = completed_at_by_id.get(issue_id)
            if started_at and completed_at and completed_at > started_at:
                started_hours.append(
                    round((completed_at - started_at).total_seconds() / 3600, 2)
                )
        # Use started_at→completed_at for "In Progress" only when we have no transition data for it
        for name, position, _ in ordered_states:
            if name.strip().lower() in _STARTED_STATE_NAMES:
                if name not in hours_by_state and started_hours:
                    hours_by_state[name] = started_hours
                break

        # Build stage stats per ordered state
        stage_stats: dict[str, dict] = {}
        for name, position, _ in ordered_states:
            hours = hours_by_state.get(name, [])
            st = stats(hours)
            stage_stats[name] = st

        # Overall aggregate (for backward compat: count / median / average)
        all_hours: list[float] = []
        for h in hours_by_state.values():
            all_hours.extend(h)
        overall = stats(all_hours)
        if not all_hours and started_hours:
            overall = stats(started_hours)

        stages = []
        for name, position, _ in ordered_states:
            st = stage_stats.get(name, stats([]))
            # When we have time stats, show number of issues that had time in this state; else current state count
            count = st["count"] if st["count"] > 0 else counts_by_state.get(name, 0)
            stages.append(
                {
                    "id": slug(name),
                    "label": name,
                    "position": position,
                    "count": count,
                    "min_hours": st["min_hours"],
                    "max_hours": st["max_hours"],
                    "median_hours": st["median_hours"],
                    "average_hours": st["average_hours"],
                }
            )

        if not stages:
            for state_name in sorted(counts_by_state.keys()):
                st = stage_stats.get(state_name, stats([]))
                stages.append(
                    {
                        "id": slug(state_name),
                        "label": state_name,
                        "position": 0.0,
                        "count": counts_by_state[state_name],
                        "min_hours": st["min_hours"],
                        "max_hours": st["max_hours"],
                        "median_hours": st["median_hours"],
                        "average_hours": st["average_hours"],
                    }
                )

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": overall["count"],
            "average_hours": overall["average_hours"],
            "median_hours": overall["median_hours"],
            "min_hours": overall["min_hours"],
            "max_hours": overall["max_hours"],
            "stages": stages,
        }

    async def get_overview(
        self,
        start_date: datetime,
        end_date: datetime,
        team_id: int | None = None,
        team_ids: list[int] | None = None,
        assignee_name: str | None = None,
    ) -> dict:
        """
        Single response for dashboard: issues completed, backlog, time-in-state.
        """
        issues_completed = await self.get_issues_completed(
            start_date,
            end_date,
            period="week",
            team_id=team_id,
            team_ids=team_ids,
            assignee_name=assignee_name,
        )
        backlog = await self.get_backlog(
            team_id=team_id, team_ids=team_ids, assignee_name=assignee_name
        )
        time_in_state = await self.get_time_in_state(
            start_date,
            end_date,
            team_id=team_id,
            team_ids=team_ids,
            assignee_name=assignee_name,
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
