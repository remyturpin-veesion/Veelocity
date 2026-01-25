import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select

from app.connectors.factory import (
    create_github_actions_connector,
    create_github_connector,
    create_linear_connector,
)
from app.core.database import async_session_maker
from app.models.github import PullRequest, Repository
from app.services.linking import LinkingService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _get_repos_without_data(db) -> list[str]:
    """Find repositories that have no PRs synced (need full sync)."""
    # Get all repos
    repos_result = await db.execute(select(Repository))
    repos = repos_result.scalars().all()
    
    repos_without_data = []
    for repo in repos:
        # Check if repo has any PRs
        pr_count_result = await db.execute(
            select(func.count(PullRequest.id)).where(PullRequest.repo_id == repo.id)
        )
        pr_count = pr_count_result.scalar() or 0
        
        if pr_count == 0:
            repos_without_data.append(repo.full_name)
    
    return repos_without_data


async def _sync_connector_safe(connector, db, method: str = "sync_recent"):
    """Sync a connector with error handling - doesn't fail if one connector errors."""
    if not connector:
        return 0, []
    
    try:
        if method == "sync_all":
            result = await connector.sync_all(db)
        else:
            result = await connector.sync_recent(db)
        
        await connector.close()
        return result.items_synced, result.errors
    except Exception as e:
        logger.error(f"Connector {connector.name} failed: {e}")
        try:
            await connector.close()
        except Exception:
            pass
        return 0, [str(e)]


async def run_sync():
    """
    Run smart sync for all configured connectors.
    
    - Uses incremental sync for repos with existing data
    - Detects repos with no data and triggers full sync for them
    - Continues even if one repo/connector fails
    """
    async with async_session_maker() as db:
        total_items = 0
        total_errors = []

        # Check for repos that need full sync (no data yet)
        repos_needing_full_sync = await _get_repos_without_data(db)
        if repos_needing_full_sync:
            logger.warning(
                f"Found {len(repos_needing_full_sync)} repos without data: "
                f"{repos_needing_full_sync}. Will do full sync for these."
            )

        # GitHub connector (PRs, reviews, comments, commits)
        github = create_github_connector()
        if github:
            # If any repo needs full sync, do full sync
            if repos_needing_full_sync:
                logger.info("Running full GitHub sync due to repos without data")
                items, errors = await _sync_connector_safe(github, db, "sync_all")
            else:
                items, errors = await _sync_connector_safe(github, db, "sync_recent")
            total_items += items
            total_errors.extend(errors)
            logger.info(f"GitHub sync: {items} items, {len(errors)} errors")

        # GitHub Actions connector (workflows, runs) - can run in parallel with Linear
        github_actions = create_github_actions_connector()
        linear = create_linear_connector()

        # Run GitHub Actions and Linear in parallel
        async def sync_actions():
            if not github_actions:
                return 0, []
            if repos_needing_full_sync:
                return await _sync_connector_safe(github_actions, db, "sync_all")
            return await _sync_connector_safe(github_actions, db, "sync_recent")

        async def sync_linear():
            if not linear:
                return 0, []
            if repos_needing_full_sync:
                return await _sync_connector_safe(linear, db, "sync_all")
            return await _sync_connector_safe(linear, db, "sync_recent")

        # Execute in parallel
        results = await asyncio.gather(sync_actions(), sync_linear())
        
        for items, errors in results:
            total_items += items
            total_errors.extend(errors)

        if github_actions:
            logger.info(f"GitHub Actions sync: {results[0][0]} items")
        if linear:
            logger.info(f"Linear sync: {results[1][0]} items")

        # Link PRs to issues after sync
        if github and linear:
            try:
                linking_service = LinkingService(db)
                linked = await linking_service.link_all_prs()
                logger.info(f"Linked {linked} PRs to issues")
            except Exception as e:
                logger.error(f"Linking failed: {e}")
                total_errors.append(str(e))

        logger.info(
            f"Sync complete: {total_items} items total, {len(total_errors)} errors"
        )
        if total_errors:
            logger.warning(f"Errors during sync: {total_errors}")


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
