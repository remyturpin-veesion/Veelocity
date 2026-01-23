from abc import ABC, abstractmethod
from datetime import datetime

from app.schemas.connector import SyncResult


class BaseConnector(ABC):
    """Interface for all data source connectors."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique connector name."""
        ...

    @abstractmethod
    async def test_connection(self) -> bool:
        """Test if the connection is valid."""
        ...

    @abstractmethod
    async def sync_all(self, db) -> SyncResult:
        """Full sync of all data."""
        ...

    @abstractmethod
    async def sync_recent(self, db, since: datetime) -> SyncResult:
        """Incremental sync since a given date."""
        ...

    @abstractmethod
    def get_supported_metrics(self) -> list[str]:
        """List metrics this connector supports."""
        ...
