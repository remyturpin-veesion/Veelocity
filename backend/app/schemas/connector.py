from datetime import datetime
from pydantic import BaseModel


class SyncResult(BaseModel):
    """Result of a sync operation."""

    connector_name: str
    started_at: datetime
    completed_at: datetime
    items_synced: int
    errors: list[str] = []

    @property
    def success(self) -> bool:
        return len(self.errors) == 0


class ConnectorStatus(BaseModel):
    """Status of a connector."""

    name: str
    connected: bool
    last_sync: datetime | None = None
    last_sync_items: int | None = None
