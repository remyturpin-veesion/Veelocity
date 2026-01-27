import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select, update

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
            result = await connector.sync_all(db, fetch_details=True)
        elif method == "sync_all_fast":
            result = await connector.sync_all(db, fetch_details=False)
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
    
    - Fast sync (PRs only) for repos without data
    - Incremental sync for repos with existing data
    - Continues even if one repo/connector fails
    """
    from app.connectors.rate_limiter import get_rate_limiter
    
    # Reset rate limiter at start of sync
    rate_limiter = get_rate_limiter()
    rate_limiter.reset()
    
    async with async_session_maker() as db:
        total_items = 0
        total_errors = []

        # Check for repos that need full sync (no data yet)
        repos_needing_full_sync = await _get_repos_without_data(db)
        if repos_needing_full_sync:
            logger.info(
                f"Found {len(repos_needing_full_sync)} repos without data: "
                f"{repos_needing_full_sync}. Running fast sync (PRs only)."
            )

        # GitHub connector (PRs, reviews, comments, commits)
        github = create_github_connector()
        if github:
            # If any repo needs full sync, do fast sync (PRs only, no details)
            if repos_needing_full_sync:
                logger.info("Running fast GitHub sync (PRs only, no details)")
                items, errors = await _sync_connector_safe(github, db, "sync_all_fast")
            else:
                items, errors = await _sync_connector_safe(github, db, "sync_recent")
            total_items += items
            total_errors.extend(errors)
            logger.info(f"GitHub sync: {items} items, {len(errors)} errors")

        # GitHub Actions and Linear in parallel
        github_actions = create_github_actions_connector()
        linear = create_linear_connector()

        async def sync_actions():
            if not github_actions:
                return 0, []
            return await _sync_connector_safe(github_actions, db, "sync_recent")

        async def sync_linear():
            if not linear:
                return 0, []
            return await _sync_connector_safe(linear, db, "sync_recent")

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
    Run full sync for all connectors with pagination.
    
    Use this for initial sync or to recover from issues.
    Processes PRs in batches to avoid timeouts.
    """
    async with async_session_maker() as db:
        total_items = 0

        # GitHub - sync PRs first (fast)
        github = create_github_connector()
        if github:
            logger.info("Full sync: fetching all PRs...")
            result = await github.sync_all(db, fetch_details=False)
            total_items += result.items_synced
            await github.close()
            logger.info(f"Full sync: {result.items_synced} PRs synced")

        # GitHub Actions
        github_actions = create_github_actions_connector()
        if github_actions:
            result = await github_actions.sync_all(db)
            total_items += result.items_synced
            await github_actions.close()
            logger.info(f"Full sync: {result.items_synced} workflow runs synced")

        # Linear
        linear = create_linear_connector()
        if linear:
            result = await linear.sync_all(db)
            total_items += result.items_synced
            await linear.close()
            logger.info(f"Full sync: {result.items_synced} Linear items synced")

        # Link PRs to issues
        linking_service = LinkingService(db)
        await linking_service.link_all_prs()

        logger.info(f"Full sync complete: {total_items} items (details will be filled gradually)")


async def run_fill_details(batch_size: int = 100):
    """
    Fill in missing details (reviews/comments/commits) for PRs.
    
    This runs periodically to gradually complete PR data without
    blocking the initial fast sync.
    
    Args:
        batch_size: Number of PRs to process per run (default 100 = ~300 API calls)
    """
    from datetime import datetime
    
    from app.connectors.rate_limiter import get_rate_limiter
    
    async with async_session_maker() as db:
        # Find PRs that haven't had their details synced yet
        prs_without_details = await db.execute(
            select(
                PullRequest.id,
                PullRequest.number,
                Repository.id,
                Repository.full_name,
            )
            .join(Repository)
            .where(PullRequest.details_synced_at.is_(None))
            .order_by(PullRequest.updated_at.desc())
            .limit(batch_size)
        )
        # Extract values immediately to avoid lazy loading after commit
        prs_to_process = [
            {
                "pr_id": row[0],
                "pr_number": row[1],
                "repo_id": row[2],
                "repo_full_name": row[3],
            }
            for row in prs_without_details.all()
        ]
        
        if not prs_to_process:
            logger.debug("No PRs need details filled")
            return
        
        # Count total remaining
        total_remaining_result = await db.execute(
            select(func.count(PullRequest.id))
            .where(PullRequest.details_synced_at.is_(None))
        )
        total_remaining = total_remaining_result.scalar() or 0
        
        logger.info(
            f"Filling details for {len(prs_to_process)} PRs "
            f"({total_remaining} total remaining)"
        )
        
        github = create_github_connector()
        if not github:
            return
        
        # Reset rate limiter for this batch
        rate_limiter = get_rate_limiter()
        rate_limiter.reset()
        
        from app.services.sync import SyncService
        sync_service = SyncService(db, github)
        
        items_synced = 0
        prs_processed = 0
        
        for pr_data in prs_to_process:
            pr_id = pr_data["pr_id"]
            pr_number = pr_data["pr_number"]
            repo_id = pr_data["repo_id"]
            repo_full_name = pr_data["repo_full_name"]
            
            try:
                # Fetch all details for this PR
                reviews = await github.fetch_reviews(repo_full_name, pr_number)
                items_synced += await sync_service._upsert_reviews(pr_id, reviews)
                
                comments = await github.fetch_comments(repo_full_name, pr_number)
                items_synced += await sync_service._upsert_comments(pr_id, comments)
                
                commits = await github.fetch_pr_commits(repo_full_name, pr_number)
                items_synced += await sync_service._upsert_commits(repo_id, pr_id, commits)
                
                # Mark PR as having details synced (UPDATE handles missing PR gracefully)
                await db.execute(
                    update(PullRequest)
                    .where(PullRequest.id == pr_id)
                    .values(details_synced_at=datetime.utcnow())
                )
                
                prs_processed += 1
                await db.commit()
            except Exception as e:
                logger.warning(f"Failed to fill details for PR #{pr_number}: {e}")
                await db.rollback()
                continue
        
        await github.close()
        
        stats = rate_limiter.get_stats()
        logger.info(
            f"Filled {items_synced} items for {prs_processed} PRs "
            f"({total_remaining - prs_processed} still remaining, "
            f"{stats['calls_made']} API calls)"
        )


def start_scheduler():
    """Start the periodic sync scheduler."""
    # Main sync every hour
    scheduler.add_job(
        run_sync,
        "interval",
        hours=1,
        id="incremental_sync",
        replace_existing=True,
    )
    
    # Fill details every 10 minutes (gradual background processing)
    scheduler.add_job(
        run_fill_details,
        "interval",
        minutes=10,
        id="fill_details",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("Scheduler started: sync every 1h, fill details every 10min")


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown(wait=False)
