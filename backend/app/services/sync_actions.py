"""Sync service for GitHub Actions data."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.github_actions import GitHubActionsConnector
from app.models.github import Repository, Workflow, WorkflowRun
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


class SyncActionsService:
    """Orchestrates sync of GitHub Actions data."""

    def __init__(self, db: AsyncSession, connector: GitHubActionsConnector):
        self._db = db
        self._connector = connector
        self._sync_state = SyncStateService(db)

    async def sync_all(self) -> int:
        """Full sync of workflows and runs."""
        count = 0

        # Get all repos from database
        result = await self._db.execute(select(Repository))
        repos = result.scalars().all()

        for repo in repos:
            workflows = await self._connector.fetch_workflows(repo.full_name)
            count += await self._upsert_workflows(repo.id, workflows)

            for wf_data in workflows:
                workflow = await self._get_workflow_by_github_id(wf_data["github_id"])
                if not workflow:
                    continue

                runs = await self._connector.fetch_workflow_runs(
                    repo.full_name, wf_data["github_id"]
                )
                count += await self._upsert_runs(workflow.id, runs)

        await self._sync_state.update_last_full_sync(self._connector.name)
        await self._db.commit()
        logger.info(f"GitHub Actions full sync: {count} items")
        return count

    async def sync_recent(self) -> int:
        """
        Incremental sync - fetch only recent runs.

        For Actions, we limit the number of pages fetched since runs
        are sorted by date. This effectively gives us recent runs only.
        """
        count = 0

        result = await self._db.execute(select(Repository))
        repos = result.scalars().all()

        for repo in repos:
            # Always sync workflows (lightweight call)
            workflows = await self._connector.fetch_workflows(repo.full_name)
            count += await self._upsert_workflows(repo.id, workflows)

            for wf_data in workflows:
                workflow = await self._get_workflow_by_github_id(wf_data["github_id"])
                if not workflow:
                    continue

                # Fetch only first page of runs (most recent)
                runs = await self._connector.fetch_workflow_runs(
                    repo.full_name, wf_data["github_id"], max_pages=1
                )
                count += await self._upsert_runs(workflow.id, runs)

        await self._sync_state.update_last_sync(self._connector.name)
        await self._db.commit()
        logger.info(f"GitHub Actions incremental sync: {count} items")
        return count

    async def _upsert_workflows(self, repo_id: int, workflows: list[dict]) -> int:
        """Insert or update workflows."""
        count = 0
        for data in workflows:
            result = await self._db.execute(
                select(Workflow).where(Workflow.github_id == data["github_id"])
            )
            existing = result.scalar_one_or_none()
            wf_data = {**data, "repo_id": repo_id}

            if existing:
                for key, value in wf_data.items():
                    if key != "github_id":
                        setattr(existing, key, value)
            else:
                self._db.add(Workflow(**wf_data))
            count += 1

        await self._db.flush()
        return count

    async def _upsert_runs(self, workflow_id: int, runs: list[dict]) -> int:
        """Insert or update workflow runs."""
        count = 0
        for data in runs:
            result = await self._db.execute(
                select(WorkflowRun).where(WorkflowRun.github_id == data["github_id"])
            )
            existing = result.scalar_one_or_none()

            # Use run's actual date (from API) so daily coverage charts show when runs happened, not when we synced
            created_at = _parse_datetime(data.get("created_at"))
            if created_at is None:
                created_at = _parse_datetime(data.get("started_at")) or _parse_datetime(
                    data.get("completed_at")
                )

            run_data = {
                "github_id": data["github_id"],
                "workflow_id": workflow_id,
                "status": data["status"],
                "conclusion": data.get("conclusion"),
                "run_number": data["run_number"],
                "head_sha": data["head_sha"],
                "head_branch": data["head_branch"],
                "created_at": created_at
                or datetime.utcnow(),  # fallback only if API had no date
                "started_at": _parse_datetime(data.get("started_at")),
                "completed_at": _parse_datetime(data.get("completed_at")),
            }

            if existing:
                for key, value in run_data.items():
                    if key != "github_id":
                        setattr(existing, key, value)
            else:
                self._db.add(WorkflowRun(**run_data))
            count += 1

        await self._db.flush()
        return count

    async def _get_workflow_by_github_id(self, github_id: int) -> Workflow | None:
        """Get workflow by GitHub ID."""
        result = await self._db.execute(
            select(Workflow).where(Workflow.github_id == github_id)
        )
        return result.scalar_one_or_none()
