import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.connectors.factory import create_github_connector
from app.core.database import async_session_maker

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_sync():
    """Run sync job for all configured connectors."""
    github = create_github_connector()
    if not github:
        logger.info("No GitHub connector configured, skipping sync")
        return

    async with async_session_maker() as db:
        since = datetime.now(timezone.utc) - timedelta(hours=1)
        result = await github.sync_recent(db, since)
        logger.info(f"Sync complete: {result.items_synced} items, {len(result.errors)} errors")

    await github.close()


def start_scheduler():
    """Start the periodic sync scheduler."""
    scheduler.add_job(run_sync, "interval", hours=1, id="github_sync", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started: sync every 1 hour")


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown(wait=False)
