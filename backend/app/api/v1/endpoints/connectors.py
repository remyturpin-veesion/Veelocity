from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.factory import create_github_connector
from app.core.database import get_db
from app.schemas.connector import ConnectorStatus, SyncResult

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/status", response_model=list[ConnectorStatus])
async def get_connectors_status():
    """Get status of all configured connectors."""
    statuses = []
    github = create_github_connector()
    if github:
        connected = await github.test_connection()
        statuses.append(ConnectorStatus(name="github", connected=connected))
        await github.close()
    return statuses


@router.post("/sync", response_model=SyncResult | None)
async def trigger_sync(db: AsyncSession = Depends(get_db)):
    """Trigger full sync of all connectors."""
    github = create_github_connector()
    if not github:
        return None
    result = await github.sync_all(db)
    await github.close()
    return result
