from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.factory import create_github_actions_connector, create_github_connector
from app.core.database import get_db
from app.schemas.connector import ConnectorStatus, SyncResult

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/status", response_model=list[ConnectorStatus])
async def get_connectors_status():
    """Get status of all configured connectors."""
    statuses = []

    # GitHub connector
    github = create_github_connector()
    if github:
        connected = await github.test_connection()
        statuses.append(ConnectorStatus(name="github", connected=connected))
        await github.close()

    # GitHub Actions connector
    github_actions = create_github_actions_connector()
    if github_actions:
        connected = await github_actions.test_connection()
        statuses.append(ConnectorStatus(name="github_actions", connected=connected))
        await github_actions.close()

    return statuses


@router.post("/sync", response_model=list[SyncResult])
async def trigger_sync(db: AsyncSession = Depends(get_db)):
    """Trigger full sync of all connectors."""
    results = []

    # Sync GitHub data (repos, PRs, reviews, comments, commits)
    github = create_github_connector()
    if github:
        result = await github.sync_all(db)
        results.append(result)
        await github.close()

    # Sync GitHub Actions data (workflows, runs)
    github_actions = create_github_actions_connector()
    if github_actions:
        result = await github_actions.sync_all(db)
        results.append(result)
        await github_actions.close()

    return results
