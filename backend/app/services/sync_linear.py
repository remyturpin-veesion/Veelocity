"""Sync service for Linear data."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.linear import LinearConnector
from app.models.linear import LinearIssue, LinearTeam
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

        # Sync issues
        issues = await self._connector.fetch_issues()
        count += await self._upsert_issues(issues, team_map)

        await self._sync_state.update_last_full_sync(self._connector.name)
        await self._db.commit()
        logger.info(f"Linear full sync: {count} items")
        return count

    async def sync_recent(self) -> int:
        """
        Incremental sync of Linear data.
        
        Linear GraphQL API supports updatedAt filter, but for simplicity
        we fetch recent issues (limited to 100) and upsert.
        """
        count = 0

        # Sync teams (lightweight)
        teams = await self._connector.fetch_teams()
        count += await self._upsert_teams(teams)

        team_map = await self._build_team_map()

        # Fetch recent issues (limited)
        issues = await self._connector.fetch_issues(limit=100)
        count += await self._upsert_issues(issues, team_map)

        await self._sync_state.update_last_sync(self._connector.name)
        await self._db.commit()
        logger.info(f"Linear incremental sync: {count} items")
        return count

    async def _upsert_teams(self, teams: list[dict]) -> int:
        """Insert or update teams."""
        count = 0
        for data in teams:
            result = await self._db.execute(
                select(LinearTeam).where(LinearTeam.linear_id == data["linear_id"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                for key, value in data.items():
                    if key != "linear_id":
                        setattr(existing, key, value)
            else:
                self._db.add(LinearTeam(**data))
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
