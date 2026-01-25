from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.factory import (
    create_github_actions_connector,
    create_github_connector,
    create_linear_connector,
)
from app.core.database import get_db
from app.schemas.connector import ConnectorStatus, SyncResult
from app.services.linking import LinkingService

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

    # Linear connector
    linear = create_linear_connector()
    if linear:
        connected = await linear.test_connection()
        statuses.append(ConnectorStatus(name="linear", connected=connected))
        await linear.close()

    return statuses


@router.post("/sync", response_model=list[SyncResult])
async def trigger_sync(
    full: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger sync of all connectors.
    
    By default, performs incremental sync (only new/updated data).
    Use ?full=true for a complete resync of all data.
    """
    results = []

    # Sync GitHub data
    github = create_github_connector()
    if github:
        if full:
            result = await github.sync_all(db)
        else:
            result = await github.sync_recent(db)
        results.append(result)
        await github.close()

    # Sync GitHub Actions data
    github_actions = create_github_actions_connector()
    if github_actions:
        if full:
            result = await github_actions.sync_all(db)
        else:
            result = await github_actions.sync_recent(db)
        results.append(result)
        await github_actions.close()

    # Sync Linear data
    linear = create_linear_connector()
    if linear:
        if full:
            result = await linear.sync_all(db)
        else:
            result = await linear.sync_recent(db)
        results.append(result)
        await linear.close()

    # Link PRs to issues after sync
    linking_service = LinkingService(db)
    await linking_service.link_all_prs()

    return results


@router.post("/link")
async def trigger_linking(db: AsyncSession = Depends(get_db)):
    """Trigger PR-to-issue linking without sync."""
    linking_service = LinkingService(db)
    count = await linking_service.link_all_prs()
    return {"linked": count}


@router.get("/sync-state")
async def get_sync_state(db: AsyncSession = Depends(get_db)):
    """Get last sync timestamps for all connectors."""
    from sqlalchemy import select
    from app.models.sync import SyncState

    result = await db.execute(select(SyncState))
    states = result.scalars().all()

    return [
        {
            "connector": state.connector_name,
            "last_sync_at": state.last_sync_at.isoformat() if state.last_sync_at else None,
            "last_full_sync_at": state.last_full_sync_at.isoformat() if state.last_full_sync_at else None,
        }
        for state in states
    ]
