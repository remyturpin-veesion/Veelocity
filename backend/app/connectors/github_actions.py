"""GitHub Actions connector for workflows and runs."""

from datetime import datetime, timezone

import httpx

from app.connectors.base import BaseConnector
from app.core.config import is_deployment_workflow
from app.schemas.connector import SyncResult


class GitHubActionsConnector(BaseConnector):
    """Connector for GitHub Actions API."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str, repos: list[str]):
        self._token = token
        self._repos = repos
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            timeout=30.0,
        )

    @property
    def name(self) -> str:
        return "github_actions"

    def get_supported_metrics(self) -> list[str]:
        return ["deployment_frequency", "lead_time_for_changes"]

    async def test_connection(self) -> bool:
        """Test connection using the GitHub user endpoint."""
        response = await self._client.get("/user")
        return response.status_code == 200

    async def fetch_workflows(self, repo_full_name: str) -> list[dict]:
        """Fetch all workflows for a repository."""
        workflows = []
        page = 1
        while True:
            response = await self._client.get(
                f"/repos/{repo_full_name}/actions/workflows",
                params={"per_page": 100, "page": page},
            )
            if response.status_code != 200:
                break
            data = response.json()
            for wf in data.get("workflows", []):
                workflows.append({
                    "github_id": wf["id"],
                    "name": wf["name"],
                    "path": wf["path"],
                    "state": wf["state"],
                    "is_deployment": is_deployment_workflow(wf["name"], wf["path"]),
                })
            if len(data.get("workflows", [])) < 100:
                break
            page += 1
        return workflows

    async def fetch_workflow_runs(
        self,
        repo_full_name: str,
        workflow_id: int,
        per_page: int = 100,
        max_pages: int = 5,
    ) -> list[dict]:
        """
        Fetch recent runs for a workflow.
        
        Limited to max_pages to avoid API rate limits.
        """
        runs = []
        page = 1
        while page <= max_pages:
            response = await self._client.get(
                f"/repos/{repo_full_name}/actions/workflows/{workflow_id}/runs",
                params={"per_page": per_page, "page": page},
            )
            if response.status_code != 200:
                break
            data = response.json()
            for run in data.get("workflow_runs", []):
                runs.append({
                    "github_id": run["id"],
                    "status": run["status"],
                    "conclusion": run.get("conclusion"),
                    "run_number": run["run_number"],
                    "head_sha": run["head_sha"],
                    "head_branch": run["head_branch"],
                    "started_at": run.get("run_started_at"),
                    "completed_at": run.get("updated_at") if run["status"] == "completed" else None,
                })
            if len(data.get("workflow_runs", [])) < per_page:
                break
            page += 1
        return runs

    async def sync_all(self, db) -> SyncResult:
        """Sync all workflows and runs."""
        started_at = datetime.now(timezone.utc)
        items_synced = 0
        errors = []

        from app.services.sync_actions import SyncActionsService

        sync_service = SyncActionsService(db, self)
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
        """Sync recent data. Currently same as sync_all with limited pages."""
        return await self.sync_all(db)

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()
