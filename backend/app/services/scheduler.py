import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.connectors.factory import (
    create_github_actions_connector,
    create_github_connector,
    create_linear_connector,
)
from app.core.database import async_session_maker
from app.services.linking import LinkingService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_sync():
    """
    Run incremental sync for all configured connectors.
    
    Uses last_sync_at from database to only fetch new/updated data.
    """
    async with async_session_maker() as db:
        total_items = 0
        total_errors = []

        # GitHub connector (PRs, reviews, comments, commits)
        github = create_github_connector()
        if github:
            result = await github.sync_recent(db)
            total_items += result.items_synced
            total_errors.extend(result.errors)
            await github.close()
            logger.info(f"GitHub sync: {result.items_synced} items")

        # GitHub Actions connector (workflows, runs)
        github_actions = create_github_actions_connector()
        if github_actions:
            result = await github_actions.sync_recent(db)
            total_items += result.items_synced
            total_errors.extend(result.errors)
            await github_actions.close()
            logger.info(f"GitHub Actions sync: {result.items_synced} items")

        # Linear connector (teams, issues)
        linear = create_linear_connector()
        if linear:
            result = await linear.sync_recent(db)
            total_items += result.items_synced
            total_errors.extend(result.errors)
            await linear.close()
            logger.info(f"Linear sync: {result.items_synced} items")

        # Link PRs to issues after sync
        if github and linear:
            linking_service = LinkingService(db)
            linked = await linking_service.link_all_prs()
            logger.info(f"Linked {linked} PRs to issues")

        logger.info(
            f"Sync complete: {total_items} items total, {len(total_errors)} errors"
        )


async def run_full_sync():
    """
    Run full sync for all connectors.
    
    Use this for initial sync or to recover from issues.
    """
    async with async_session_maker() as db:
        total_items = 0

        github = create_github_connector()
        if github:
            result = await github.sync_all(db)
            total_items += result.items_synced
            await github.close()

        github_actions = create_github_actions_connector()
        if github_actions:
            result = await github_actions.sync_all(db)
            total_items += result.items_synced
            await github_actions.close()

        linear = create_linear_connector()
        if linear:
            result = await linear.sync_all(db)
            total_items += result.items_synced
            await linear.close()

        # Link PRs to issues
        linking_service = LinkingService(db)
        await linking_service.link_all_prs()

        logger.info(f"Full sync complete: {total_items} items")


def start_scheduler():
    """Start the periodic sync scheduler."""
    scheduler.add_job(
        run_sync,
        "interval",
        hours=1,
        id="incremental_sync",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: incremental sync every 1 hour")


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown(wait=False)
