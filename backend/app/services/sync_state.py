"""Sync state management service."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync import SyncState


class SyncStateService:
    """Manages sync state for connectors."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_last_sync(self, connector_name: str) -> datetime | None:
        """Get the last sync timestamp for a connector."""
        result = await self._db.execute(
            select(SyncState).where(SyncState.connector_name == connector_name)
        )
        state = result.scalar_one_or_none()
        return state.last_sync_at if state else None

    async def get_last_full_sync(self, connector_name: str) -> datetime | None:
        """Get the last full sync timestamp for a connector."""
        result = await self._db.execute(
            select(SyncState).where(SyncState.connector_name == connector_name)
        )
        state = result.scalar_one_or_none()
        return state.last_full_sync_at if state else None

    async def update_last_sync(
        self, connector_name: str, sync_at: datetime | None = None
    ) -> None:
        """Update the last sync timestamp for a connector."""
        if sync_at is None:
            sync_at = datetime.utcnow()

        result = await self._db.execute(
            select(SyncState).where(SyncState.connector_name == connector_name)
        )
        state = result.scalar_one_or_none()

        if state:
            state.last_sync_at = sync_at
        else:
            state = SyncState(
                connector_name=connector_name,
                last_sync_at=sync_at,
            )
            self._db.add(state)

        await self._db.flush()

    async def update_last_full_sync(
        self, connector_name: str, sync_at: datetime | None = None
    ) -> None:
        """Update the last full sync timestamp for a connector."""
        if sync_at is None:
            sync_at = datetime.utcnow()

        result = await self._db.execute(
            select(SyncState).where(SyncState.connector_name == connector_name)
        )
        state = result.scalar_one_or_none()

        if state:
            state.last_full_sync_at = sync_at
            state.last_sync_at = sync_at
        else:
            state = SyncState(
                connector_name=connector_name,
                last_sync_at=sync_at,
                last_full_sync_at=sync_at,
            )
            self._db.add(state)

        await self._db.flush()
