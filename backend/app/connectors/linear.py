"""Linear connector for teams and issues."""

from datetime import datetime, timezone

import httpx

from app.connectors.base import BaseConnector
from app.schemas.connector import SyncResult


class LinearConnector(BaseConnector):
    """Connector for Linear GraphQL API."""

    BASE_URL = "https://api.linear.app/graphql"

    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    @property
    def name(self) -> str:
        return "linear"

    def get_supported_metrics(self) -> list[str]:
        return ["cycle_time", "throughput"]

    async def test_connection(self) -> bool:
        """Test connection by fetching viewer info."""
        query = "{ viewer { id name } }"
        try:
            response = await self._client.post(
                self.BASE_URL, json={"query": query}
            )
            if response.status_code == 200:
                data = response.json()
                return "data" in data and data["data"].get("viewer") is not None
            return False
        except Exception:
            return False

    async def fetch_teams(self) -> list[dict]:
        """Fetch all teams."""
        query = """
        {
            teams {
                nodes {
                    id
                    name
                    key
                }
            }
        }
        """
        response = await self._client.post(self.BASE_URL, json={"query": query})
        if response.status_code != 200:
            return []

        data = response.json()
        teams = data.get("data", {}).get("teams", {}).get("nodes", [])

        return [
            {
                "linear_id": team["id"],
                "name": team["name"],
                "key": team["key"],
            }
            for team in teams
        ]

    async def fetch_issues(
        self, team_id: str | None = None, limit: int = 100
    ) -> list[dict]:
        """
        Fetch issues, optionally filtered by team.
        
        Uses pagination with cursor for large datasets.
        """
        issues = []
        cursor = None
        
        while True:
            query = """
            query($teamId: String, $first: Int!, $after: String) {
                issues(
                    filter: { team: { id: { eq: $teamId } } }
                    first: $first
                    after: $after
                ) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    nodes {
                        id
                        identifier
                        title
                        description
                        priority
                        state {
                            name
                        }
                        assignee {
                            name
                        }
                        team {
                            id
                        }
                        createdAt
                        startedAt
                        completedAt
                        canceledAt
                    }
                }
            }
            """
            
            variables = {
                "first": min(limit, 100),
                "after": cursor,
            }
            if team_id:
                variables["teamId"] = team_id

            response = await self._client.post(
                self.BASE_URL,
                json={"query": query, "variables": variables},
            )
            
            if response.status_code != 200:
                break

            data = response.json()
            issues_data = data.get("data", {}).get("issues", {})
            nodes = issues_data.get("nodes", [])
            
            for issue in nodes:
                issues.append({
                    "linear_id": issue["id"],
                    "identifier": issue["identifier"],
                    "title": issue["title"],
                    "description": issue.get("description"),
                    "priority": issue.get("priority", 0),
                    "state": issue.get("state", {}).get("name", "Unknown"),
                    "assignee_name": issue.get("assignee", {}).get("name") if issue.get("assignee") else None,
                    "team_linear_id": issue.get("team", {}).get("id"),
                    "created_at": issue.get("createdAt"),
                    "started_at": issue.get("startedAt"),
                    "completed_at": issue.get("completedAt"),
                    "canceled_at": issue.get("canceledAt"),
                })
            
            page_info = issues_data.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info.get("endCursor")
            
            # Safety limit
            if len(issues) >= 1000:
                break

        return issues

    async def sync_all(self, db) -> SyncResult:
        """Sync all Linear data."""
        started_at = datetime.now(timezone.utc)
        items_synced = 0
        errors = []

        from app.services.sync_linear import SyncLinearService

        sync_service = SyncLinearService(db, self)
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

    async def sync_recent(self, db, since: datetime) -> SyncResult:
        """Sync recent data. Currently same as sync_all."""
        return await self.sync_all(db)

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()
