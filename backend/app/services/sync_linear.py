"""Sync service for Linear data."""

import logging
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.linear import LinearConnector
from app.models.linear import (
    LinearIssue,
    LinearIssueStateTransition,
    LinearTeam,
    LinearWorkflowState,
)
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)


def _parse_datetime(value: str | datetime | None) -> datetime | None:
    """Parse datetime string to naive datetime."""
    if value is None:
        return None
    if isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        dt = value
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class SyncLinearService:
    """Orchestrates sync of Linear data."""

    def __init__(self, db: AsyncSession, connector: LinearConnector):
        self._db = db
        self._connector = connector
        self._sync_state = SyncStateService(db)

    async def sync_all(self) -> int:
        """Full sync of teams and issues."""
        count = 0

        # Sync teams first
        teams = await self._connector.fetch_teams()
        count += await self._upsert_teams(teams)

        # Build team map for issue linking
        team_map = await self._build_team_map()

        # Sync all issues (no cap so every team gets full count)
        issues = await self._connector.fetch_issues(max_results=None)
        count += await self._upsert_issues(issues, team_map)

        count += await self._sync_state_transitions(limit=80)

        await self._sync_state.update_last_full_sync(self._connector.name)
        await self._db.commit()
        logger.info(f"Linear full sync: {count} items")
        return count

    async def sync_recent(self) -> int:
        """
        Incremental sync of Linear data.

        If no previous sync exists, runs full sync so Data coverage is populated.
        If we have very few issues for multiple teams (e.g. hit old 1000 cap), run full sync to backfill.
        Otherwise fetches issues updated since last sync (updatedAt filter).
        """
        since = await self._sync_state.get_last_sync(self._connector.name)
        if since is None:
            logger.info("Linear: no previous sync, running full sync")
            return await self.sync_all()

        # Backfill: if we have several teams but few issues synced, run full sync so progression catches up
        team_count_result = await self._db.execute(select(func.count(LinearTeam.id)))
        team_count = team_count_result.scalar() or 0
        issues_count_result = await self._db.execute(select(func.count(LinearIssue.id)))
        issues_count = issues_count_result.scalar() or 0
        if team_count >= 2 and issues_count < 2000:
            logger.info(
                "Linear: low issue count (%s) for %s teams, running full sync to backfill",
                issues_count,
                team_count,
            )
            return await self.sync_all()

        count = 0

        # Sync teams (lightweight)
        teams = await self._connector.fetch_teams()
        count += await self._upsert_teams(teams)

        team_map = await self._build_team_map()

        # Fetch issues updated since last sync (incremental)
        updated_after_iso = since.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        issues = await self._connector.fetch_issues(
            limit=100,
            updated_after=updated_after_iso,
            max_results=2000,
        )
        count += await self._upsert_issues(issues, team_map)

        count += await self._sync_state_transitions(limit=30)

        await self._sync_state.update_last_sync(self._connector.name)
        await self._db.commit()
        logger.info(f"Linear incremental sync: {count} items")
        return count

    async def sync_date_range(self, since: datetime, until: datetime) -> int:
        """
        Force import Linear issues created within a date range (inclusive).

        since/until are naive datetimes; we pass ISO date strings to the API.
        """
        count = 0

        teams = await self._connector.fetch_teams()
        count += await self._upsert_teams(teams)
        team_map = await self._build_team_map()

        # Linear API expects ISO 8601; use date part for start/end of day
        created_after = since.strftime("%Y-%m-%dT00:00:00Z")
        created_before = until.strftime("%Y-%m-%dT23:59:59Z")

        issues = await self._connector.fetch_issues(
            limit=1000,
            created_after=created_after,
            created_before=created_before,
        )
        count += await self._upsert_issues(issues, team_map)

        await self._db.commit()
        logger.info(f"Linear date-range sync: {count} items")
        return count

    async def _upsert_teams(self, teams: list[dict]) -> int:
        """Insert or update teams and their workflow states."""
        count = 0
        for data in teams:
            workflow_states = data.pop("workflow_states", [])
            team_data = {
                "linear_id": data["linear_id"],
                "name": data["name"],
                "key": data["key"],
            }
            result = await self._db.execute(
                select(LinearTeam).where(LinearTeam.linear_id == team_data["linear_id"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                for key, value in team_data.items():
                    if key != "linear_id":
                        setattr(existing, key, value)
                team_id = existing.id
            else:
                team = LinearTeam(**team_data)
                self._db.add(team)
                await self._db.flush()
                team_id = team.id
            count += 1
            count += await self._upsert_workflow_states(team_id, workflow_states)

        await self._db.flush()
        return count

    async def _upsert_workflow_states(
        self, team_id: int, workflow_states: list[dict]
    ) -> int:
        """Insert or update workflow states for a team."""
        count = 0
        for s in workflow_states:
            result = await self._db.execute(
                select(LinearWorkflowState).where(
                    LinearWorkflowState.team_id == team_id,
                    LinearWorkflowState.linear_id == s["linear_id"],
                )
            )
            existing = result.scalar_one_or_none()
            row = {
                "team_id": team_id,
                "linear_id": s["linear_id"],
                "name": s["name"],
                "position": s.get("position", 0),
                "type": s.get("type"),
            }
            if existing:
                for key, value in row.items():
                    if key != "team_id" and key != "linear_id":
                        setattr(existing, key, value)
            else:
                self._db.add(LinearWorkflowState(**row))
            count += 1
        await self._db.flush()
        return count

    async def _upsert_issues(
        self, issues: list[dict], team_map: dict[str, int]
    ) -> int:
        """Insert or update issues."""
        count = 0
        for data in issues:
            result = await self._db.execute(
                select(LinearIssue).where(LinearIssue.linear_id == data["linear_id"])
            )
            existing = result.scalar_one_or_none()

            # Get team_id from linear_id
            team_linear_id = data.pop("team_linear_id", None)
            team_id = team_map.get(team_linear_id) if team_linear_id else None

            if not team_id:
                # Skip issues without valid team
                continue

            issue_data = {
                "linear_id": data["linear_id"],
                "team_id": team_id,
                "identifier": data["identifier"],
                "title": data["title"],
                "description": data.get("description"),
                "state": data["state"],
                "priority": data.get("priority", 0),
                "assignee_name": data.get("assignee_name"),
                "created_at": _parse_datetime(data.get("created_at")),
                "started_at": _parse_datetime(data.get("started_at")),
                "completed_at": _parse_datetime(data.get("completed_at")),
                "canceled_at": _parse_datetime(data.get("canceled_at")),
            }

            if existing:
                for key, value in issue_data.items():
                    if key != "linear_id":
                        setattr(existing, key, value)
            else:
                self._db.add(LinearIssue(**issue_data))
            count += 1

        await self._db.flush()
        return count

    async def _build_team_map(self) -> dict[str, int]:
        """Build mapping from Linear team ID to database ID."""
        result = await self._db.execute(select(LinearTeam))
        teams = result.scalars().all()
        return {team.linear_id: team.id for team in teams}

    async def _sync_state_transitions(self, limit: int = 30) -> int:
        """
        Fetch issue history from Linear for completed issues that don't have
        state transitions yet, and upsert transitions. Returns number of
        transitions added (not issue count).
        """
        # Completed issues that have no state transitions yet
        subq = (
            select(LinearIssueStateTransition.linear_issue_id)
            .distinct()
        )
        q = (
            select(LinearIssue.id, LinearIssue.linear_id)
            .where(
                LinearIssue.completed_at.isnot(None),
                LinearIssue.id.not_in(subq),
            )
            .order_by(LinearIssue.completed_at.desc())
            .limit(limit)
        )
        result = await self._db.execute(q)
        rows = result.all()
        count = 0
        for issue_id, linear_id in rows:
            history = await self._connector.fetch_issue_history(linear_id)
            if not history:
                continue
            await self._db.execute(
                delete(LinearIssueStateTransition).where(
                    LinearIssueStateTransition.linear_issue_id == issue_id
                )
            )
            for h in history:
                created_at = _parse_datetime(h.get("created_at"))
                if not created_at:
                    continue
                self._db.add(
                    LinearIssueStateTransition(
                        linear_issue_id=issue_id,
                        from_state=h.get("from_state"),
                        to_state=h.get("to_state", "Unknown"),
                        created_at=created_at,
                    )
                )
                count += 1
        await self._db.flush()
        return count
