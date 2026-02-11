import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, func, select, update

from app.connectors.factory import (
    create_github_actions_connector,
    create_github_connector,
    create_linear_connector,
)
from app.core.database import async_session_maker
from app.services.credentials import CredentialsService
from app.models.github import PullRequest, Repository
from app.models.recommendation import RecommendationRun
from app.services.insights.recommendation_engine import RecommendationEngine
from app.services.linking import LinkingService

logger = logging.getLogger(__name__)

# In-progress state for UI (set/cleared by scheduled jobs; any job can run in parallel)
_sync_in_progress = False
_sync_job_name: str | None = None


def get_sync_job_state() -> tuple[bool, str | None]:
    """Return (sync_in_progress, current_job_name). Safe to call from API."""
    return _sync_in_progress, _sync_job_name


def set_sync_job_state(in_progress: bool, job_name: str | None = None) -> None:
    """Set sync job state (e.g. for manual linear full sync). Safe to call from API."""
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = in_progress
    _sync_job_name = job_name if in_progress else None


async def run_propose_recommendations():
    """
    Compute recommendations for the last 30 days and store as the latest
    proposed run. Runs every 10 minutes.
    """
    try:
        end = datetime.utcnow()
        start = end - timedelta(days=30)
        async with async_session_maker() as db:
            engine = RecommendationEngine(db)
            recommendations = await engine.get_recommendations(
                start_date=start,
                end_date=end,
                repo_id=None,
                repo_ids=None,
            )
            # Keep only the latest run: remove older runs then insert
            await db.execute(delete(RecommendationRun))
            run = RecommendationRun(
                run_at=end,
                period_start=start,
                period_end=end,
                repo_ids=None,
                recommendations=[r.to_dict() for r in recommendations],
            )
            db.add(run)
            await db.commit()
            logger.info(
                "Proposed %s recommendations (period %s – %s)",
                len(recommendations),
                start.date(),
                end.date(),
            )
    except Exception as e:
        logger.warning("Propose recommendations failed: %s", e)


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
    Run smart sync for GitHub and GitHub Actions only.
    Linear, Cursor, Greptile run in separate jobs (every 5 min).
    """
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "incremental_sync"
    try:
        await _run_sync_impl()
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def _resolve_repos(creds) -> list[str]:
    """Resolve org:* patterns in github_repos to a flat repo list."""
    from app.services.github_repo_resolver import (
        parse_repo_entries,
        resolve_github_repos,
    )

    if not creds.github_token or not (creds.github_repos or "").strip():
        logger.debug("No GitHub token or repos configured — nothing to resolve")
        return []

    orgs, explicit = parse_repo_entries(creds.github_repos)
    if orgs:
        logger.info(
            "Resolving org subscriptions: %s (+ %d explicit repos)",
            orgs,
            len(explicit),
        )
        resolved = await resolve_github_repos(creds.github_token, creds.github_repos)
        logger.info("Resolved %d total repos from org subscriptions", len(resolved))
        return resolved
    # No org subscriptions — split directly (fast path, no HTTP)
    repos = [x.strip() for x in creds.github_repos.split(",") if x.strip()]
    logger.debug("Using %d explicit repos (no org subscriptions)", len(repos))
    return repos


async def _run_sync_impl():
    """Implementation of run_sync (without state flags).

    Flow:
    1. Resolve org:* patterns → flat list of repos.
    2. Incremental sync (also registers newly discovered repos in the DB).
    3. After incremental sync, check for repos that still have no PR data
       (i.e. newly discovered repos) and run a targeted fast sync for them.
    """
    from app.connectors.rate_limiter import get_rate_limiter

    # Reset rate limiter at start of sync
    rate_limiter = get_rate_limiter()
    rate_limiter.reset()

    async with async_session_maker() as db:
        total_items = 0
        total_errors = []

        creds = await CredentialsService(db).get_credentials()
        # Resolve org:* patterns to actual repo list
        resolved_repos = await _resolve_repos(creds)
        if not resolved_repos:
            logger.info("No GitHub repos configured — skipping sync")
            return

        logger.info("Resolved %d GitHub repos for sync", len(resolved_repos))

        # GitHub connector (PRs, reviews, comments, commits)
        github = create_github_connector(token=creds.github_token, repos=resolved_repos)
        if github:
            # Step 1: Incremental sync — also discovers & registers new repos in DB
            items, errors = await _sync_connector_safe(github, db, "sync_recent")
            total_items += items
            total_errors.extend(errors)
            logger.info(f"GitHub incremental sync: {items} items, {len(errors)} errors")

            # Step 2: Check for repos that were just registered but have no PR data
            # (e.g. newly discovered org repos whose recent-only fetch found 0 PRs)
            repos_needing_full_sync = await _get_repos_without_data(db)
            if repos_needing_full_sync:
                logger.info(
                    f"Found {len(repos_needing_full_sync)} repos without data: "
                    f"{repos_needing_full_sync}. Running fast sync (PRs only)."
                )
                # Scoped connector: only the repos that actually need full sync
                github_new = create_github_connector(
                    token=creds.github_token, repos=repos_needing_full_sync
                )
                if github_new:
                    items, errors = await _sync_connector_safe(
                        github_new, db, "sync_all_fast"
                    )
                    total_items += items
                    total_errors.extend(errors)
                    logger.info(
                        f"New repos fast sync: {items} items, {len(errors)} errors"
                    )

        # GitHub Actions (Linear, Cursor, Greptile run in separate 5-min jobs)
        github_actions = create_github_actions_connector(
            token=creds.github_token, repos=resolved_repos
        )
        if github_actions:
            items, errors = await _sync_connector_safe(
                github_actions, db, "sync_recent"
            )
            total_items += items
            total_errors.extend(errors)
            logger.info(f"GitHub Actions sync: {items} items")

        logger.info(
            f"Sync complete: {total_items} items total, {len(total_errors)} errors"
        )
        if total_errors:
            logger.warning(f"Errors during sync: {total_errors}")


async def run_linear_sync():
    """Linear incremental sync + PR–issue linking. Runs every 5 min."""
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "linear_sync"
    try:
        async with async_session_maker() as db:
            creds = await CredentialsService(db).get_credentials()
            linear = create_linear_connector(api_key=creds.linear_api_key)
            if not linear:
                return
            try:
                items, errors = await _sync_connector_safe(linear, db, "sync_recent")
                await db.commit()
                logger.info("Linear sync: %s items", items)
                if errors:
                    logger.warning("Linear sync errors: %s", errors)
                # Link PRs to Linear issues after sync
                try:
                    linking_service = LinkingService(db)
                    linked = await linking_service.link_all_prs()
                    await db.commit()
                    if linked:
                        logger.info("Linked %s PRs to issues", linked)
                except Exception as e:
                    logger.error("Linking failed: %s", e)
            finally:
                await linear.close()
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def run_cursor_sync():
    """Cursor API sync (team, spend, usage, DAU). Runs every 5 min."""
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "cursor_sync"
    try:
        async with async_session_maker() as db:
            creds = await CredentialsService(db).get_credentials()
            if not creds.cursor_api_key:
                return
            try:
                from app.services.sync_cursor import sync_cursor

                items = await sync_cursor(db, creds.cursor_api_key)
                await db.commit()
                logger.info("Cursor sync: %s items", items)
            except Exception as e:
                logger.error("Cursor sync failed: %s", e)
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def run_greptile_sync():
    """Greptile API sync (indexed repos). Runs every 5 min."""
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "greptile_sync"
    try:
        async with async_session_maker() as db:
            creds = await CredentialsService(db).get_credentials()
            if not creds.greptile_api_key:
                return
            try:
                from app.services.sync_greptile import sync_greptile

                items = await sync_greptile(db, creds.greptile_api_key)
                await db.commit()
                logger.info("Greptile sync: %s repos", items)
            except Exception as e:
                logger.error("Greptile sync failed: %s", e)
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def run_sentry_sync():
    """Sentry API sync (projects, event counts, unresolved issues). Runs every 5 min."""
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "sentry_sync"
    try:
        async with async_session_maker() as db:
            creds = await CredentialsService(db).get_credentials()
            if not creds.sentry_api_token or not (creds.sentry_org or "").strip():
                return
            try:
                from app.services.sync_sentry import sync_sentry

                items = await sync_sentry(
                    db,
                    api_token=creds.sentry_api_token,
                    base_url=creds.sentry_base_url or "",
                    org_slug=creds.sentry_org or "",
                )
                await db.commit()
                logger.info("Sentry sync: %s projects", items)
            except Exception as e:
                logger.error("Sentry sync failed: %s", e)
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def run_full_sync():
    """
    Run full sync for all connectors with pagination.

    Use this for initial sync or to recover from issues.
    Processes PRs in batches to avoid timeouts.
    """
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "full_sync"
    try:
        await _run_full_sync_impl()
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def _run_full_sync_impl():
    """Implementation of run_full_sync (without state flags)."""
    async with async_session_maker() as db:
        creds = await CredentialsService(db).get_credentials()
        resolved_repos = await _resolve_repos(creds)
        total_items = 0

        # GitHub - sync PRs first (fast)
        github = create_github_connector(token=creds.github_token, repos=resolved_repos)
        if github:
            logger.info("Full sync: fetching all PRs...")
            result = await github.sync_all(db, fetch_details=False)
            total_items += result.items_synced
            await github.close()
            logger.info(f"Full sync: {result.items_synced} PRs synced")

        # GitHub Actions
        github_actions = create_github_actions_connector(
            token=creds.github_token, repos=resolved_repos
        )
        if github_actions:
            result = await github_actions.sync_all(db)
            total_items += result.items_synced
            await github_actions.close()
            logger.info(f"Full sync: {result.items_synced} workflow runs synced")

        # Linear
        linear = create_linear_connector(api_key=creds.linear_api_key)
        if linear:
            result = await linear.sync_all(db)
            total_items += result.items_synced
            await linear.close()
            logger.info(f"Full sync: {result.items_synced} Linear items synced")

        # Link PRs to issues
        linking_service = LinkingService(db)
        await linking_service.link_all_prs()

        # Cursor and Greptile: sync to DB
        if creds.cursor_api_key:
            try:
                from app.services.sync_cursor import sync_cursor

                cursor_items = await sync_cursor(db, creds.cursor_api_key)
                total_items += cursor_items
                await db.commit()
                logger.info("Full sync: Cursor %s items", cursor_items)
            except Exception as e:
                logger.error("Cursor sync failed: %s", e)
        if creds.greptile_api_key:
            try:
                from app.services.sync_greptile import sync_greptile

                greptile_items = await sync_greptile(db, creds.greptile_api_key)
                total_items += greptile_items
                await db.commit()
                logger.info("Full sync: Greptile %s repos", greptile_items)
            except Exception as e:
                logger.error("Greptile sync failed: %s", e)
        if creds.sentry_api_token and (creds.sentry_org or "").strip():
            try:
                from app.services.sync_sentry import sync_sentry

                sentry_items = await sync_sentry(
                    db,
                    api_token=creds.sentry_api_token,
                    base_url=creds.sentry_base_url or "",
                    org_slug=creds.sentry_org or "",
                )
                total_items += sentry_items
                await db.commit()
                logger.info("Full sync: Sentry %s projects", sentry_items)
            except Exception as e:
                logger.error("Sentry sync failed: %s", e)

        logger.info(
            f"Full sync complete: {total_items} items (details will be filled gradually)"
        )


async def run_fill_details(batch_size: int = 100):
    """
    Fill in missing details (reviews/comments/commits) for PRs.
    Runs every 10 min.
    """
    global _sync_in_progress, _sync_job_name
    _sync_in_progress = True
    _sync_job_name = "fill_details"
    try:
        await _run_fill_details_impl(batch_size)
    finally:
        _sync_in_progress = False
        _sync_job_name = None


async def _run_fill_details_impl(batch_size: int):
    """Implementation of run_fill_details (without state flags)."""
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
            select(func.count(PullRequest.id)).where(
                PullRequest.details_synced_at.is_(None)
            )
        )
        total_remaining = total_remaining_result.scalar() or 0

        logger.info(
            f"Filling details for {len(prs_to_process)} PRs "
            f"({total_remaining} total remaining)"
        )

        creds = await CredentialsService(db).get_credentials()
        resolved_repos = await _resolve_repos(creds)
        github = create_github_connector(token=creds.github_token, repos=resolved_repos)
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
                items_synced += await sync_service._upsert_commits(
                    repo_id, pr_id, commits
                )

                # List-pulls does not return additions/deletions; fetch single PR
                details = await github.fetch_pull_request_details(
                    repo_full_name, pr_number
                )
                update_values = {"details_synced_at": datetime.utcnow()}
                if details:
                    update_values["additions"] = details.get("additions", 0)
                    update_values["deletions"] = details.get("deletions", 0)
                    update_values["commits_count"] = details.get("commits_count", 0)

                await db.execute(
                    update(PullRequest)
                    .where(PullRequest.id == pr_id)
                    .values(**update_values)
                )

                prs_processed += 1
                await db.commit()
            except Exception as e:
                logger.warning(f"Failed to fill details for PR #{pr_number}: {e}")
                await db.rollback()
                continue

        # Backfill additions/deletions for PRs that were detail-synced before we stored them
        backfill_result = await db.execute(
            select(
                PullRequest.id,
                PullRequest.number,
                Repository.full_name,
            )
            .join(Repository)
            .where(PullRequest.details_synced_at.isnot(None))
            .where(PullRequest.additions == 0, PullRequest.deletions == 0)
            .order_by(PullRequest.updated_at.desc())
            .limit(50)
        )
        backfill_prs = [
            {"pr_id": r[0], "pr_number": r[1], "repo_full_name": r[2]}
            for r in backfill_result.all()
        ]
        for pr_data in backfill_prs:
            try:
                details = await github.fetch_pull_request_details(
                    pr_data["repo_full_name"], pr_data["pr_number"]
                )
                if details and (
                    details.get("additions", 0) or details.get("deletions", 0)
                ):
                    await db.execute(
                        update(PullRequest)
                        .where(PullRequest.id == pr_data["pr_id"])
                        .values(
                            additions=details.get("additions", 0),
                            deletions=details.get("deletions", 0),
                            commits_count=details.get("commits_count", 0),
                        )
                    )
                    await db.commit()
            except Exception as e:
                logger.warning(
                    f"Failed to backfill PR #{pr_data['pr_number']} stats: {e}"
                )
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
    """Start the periodic sync scheduler. Jobs are staggered so they don't all run at once."""
    now = datetime.utcnow()

    # GitHub + GitHub Actions: every 5 min (first run immediately / at :00)
    scheduler.add_job(
        run_sync,
        "interval",
        minutes=5,
        id="incremental_sync",
        replace_existing=True,
    )

    # Fill PR details every 10 min (first run in 8 min to stagger)
    scheduler.add_job(
        run_fill_details,
        "interval",
        minutes=10,
        next_run_time=now + timedelta(minutes=8),
        id="fill_details",
        replace_existing=True,
    )

    # Linear: every 5 min, first run in 2 min
    scheduler.add_job(
        run_linear_sync,
        "interval",
        minutes=5,
        next_run_time=now + timedelta(minutes=2),
        id="linear_sync",
        replace_existing=True,
    )

    # Cursor: every 5 min, first run in 4 min
    scheduler.add_job(
        run_cursor_sync,
        "interval",
        minutes=5,
        next_run_time=now + timedelta(minutes=4),
        id="cursor_sync",
        replace_existing=True,
    )

    # Greptile: every 5 min, first run in 6 min
    scheduler.add_job(
        run_greptile_sync,
        "interval",
        minutes=5,
        next_run_time=now + timedelta(minutes=6),
        id="greptile_sync",
        replace_existing=True,
    )

    # Sentry: every 5 min, first run in 7 min
    scheduler.add_job(
        run_sentry_sync,
        "interval",
        minutes=5,
        next_run_time=now + timedelta(minutes=7),
        id="sentry_sync",
        replace_existing=True,
    )

    # Propose recommendations every 10 min (first run in 10 min)
    scheduler.add_job(
        run_propose_recommendations,
        "interval",
        minutes=10,
        next_run_time=now + timedelta(minutes=10),
        id="propose_recommendations",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        "Scheduler started: GitHub+Actions every 5min, Linear/Cursor/Greptile/Sentry every 5min "
        "(staggered), fill details every 10min, propose recommendations every 10min"
    )


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown(wait=False)
