"""Greptile usage metrics: cross-references GitHub PR data with Greptile index status."""

import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.github import Commit, PRComment, PRReview, PullRequest, Repository
from app.models.greptile import GreptileRepository

logger = logging.getLogger(__name__)


def _repo_filter(repo_ids: list[int] | None) -> list[int] | None:
    """Return repo_ids list or None (all repos)."""
    if repo_ids is not None and len(repo_ids) > 0:
        return repo_ids
    return None


class GreptileMetricsService:
    """Compute Greptile code review adoption metrics by cross-referencing GitHub PR data."""

    def __init__(self, db: AsyncSession):
        self._db = db
        self._bot_login = settings.greptile_bot_login

    async def _resolve_bot_login(self) -> str:
        """
        Return the configured bot login. If no reviews exist for it,
        try to auto-detect by looking for reviewers matching 'greptile'.
        """
        configured = self._bot_login
        # Quick check: does the configured login have any reviews?
        check_q = (
            select(func.count(PRReview.id))
            .where(PRReview.reviewer_login == configured)
            .limit(1)
        )
        result = await self._db.execute(check_q)
        if (result.scalar() or 0) > 0:
            return configured

        # Auto-detect: find any reviewer login containing 'greptile'
        detect_q = (
            select(PRReview.reviewer_login, func.count(PRReview.id).label("cnt"))
            .where(PRReview.reviewer_login.ilike("%greptile%"))
            .group_by(PRReview.reviewer_login)
            .order_by(func.count(PRReview.id).desc())
            .limit(1)
        )
        detect_result = await self._db.execute(detect_q)
        row = detect_result.first()
        if row:
            logger.info(
                "Greptile bot auto-detected as '%s' (%d reviews). "
                "Set GREPTILE_BOT_LOGIN='%s' in .env to avoid this lookup.",
                row.reviewer_login,
                row.cnt,
                row.reviewer_login,
            )
            return row.reviewer_login

        return configured

    async def get_metrics(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_ids: list[int] | None = None,
        granularity: str = "week",
    ) -> dict:
        """Return full Greptile metrics response."""
        # Resolve the actual bot login (auto-detect if needed)
        self._bot_login = await self._resolve_bot_login()
        filtered_repo_ids = _repo_filter(repo_ids)

        review_coverage = await self._review_coverage(
            start_date, end_date, filtered_repo_ids
        )
        response_time = await self._avg_response_time(
            start_date, end_date, filtered_repo_ids
        )
        comments_per_pr = await self._avg_comments_per_pr(
            start_date, end_date, filtered_repo_ids
        )
        index_health = await self._index_health(filtered_repo_ids)
        per_repo = await self._per_repo_breakdown(
            start_date, end_date, filtered_repo_ids
        )
        trend = await self._review_trend(
            start_date, end_date, filtered_repo_ids, granularity
        )
        recommendations = self._build_recommendations(
            review_coverage, index_health, per_repo
        )

        return {
            "bot_login": self._bot_login,
            "review_coverage_pct": review_coverage["coverage_pct"],
            "avg_response_time_minutes": response_time,
            "avg_comments_per_pr": comments_per_pr,
            "total_prs": review_coverage["total_prs"],
            "prs_reviewed_by_greptile": review_coverage["reviewed_prs"],
            "prs_without_review": review_coverage["total_prs"]
            - review_coverage["reviewed_prs"],
            "index_health": index_health,
            "per_repo": per_repo,
            "trend": trend,
            "recommendations": recommendations,
        }

    # ------------------------------------------------------------------ #
    # Review coverage
    # ------------------------------------------------------------------ #

    async def _review_coverage(
        self, start_date: datetime, end_date: datetime, repo_ids: list[int] | None
    ) -> dict:
        """Percentage of PRs that received at least one Greptile review."""
        # Total PRs in date range
        total_q = select(func.count(PullRequest.id)).where(
            and_(
                PullRequest.created_at >= start_date,
                PullRequest.created_at <= end_date,
            )
        )
        if repo_ids:
            total_q = total_q.where(PullRequest.repo_id.in_(repo_ids))

        total_result = await self._db.execute(total_q)
        total_prs = total_result.scalar() or 0

        # PRs with at least one Greptile review
        reviewed_q = (
            select(func.count(distinct(PullRequest.id)))
            .join(PRReview, PRReview.pr_id == PullRequest.id)
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                    PRReview.reviewer_login == self._bot_login,
                )
            )
        )
        if repo_ids:
            reviewed_q = reviewed_q.where(PullRequest.repo_id.in_(repo_ids))

        reviewed_result = await self._db.execute(reviewed_q)
        reviewed_prs = reviewed_result.scalar() or 0

        coverage_pct = (
            round(100.0 * reviewed_prs / total_prs, 1) if total_prs > 0 else 0.0
        )

        return {
            "total_prs": total_prs,
            "reviewed_prs": reviewed_prs,
            "coverage_pct": coverage_pct,
        }

    # ------------------------------------------------------------------ #
    # Response time
    # ------------------------------------------------------------------ #

    async def _avg_response_time(
        self, start_date: datetime, end_date: datetime, repo_ids: list[int] | None
    ) -> float | None:
        """Average time in minutes from PR creation to first Greptile review."""
        # Subquery: first Greptile review per PR
        first_review_sq = (
            select(
                PRReview.pr_id.label("pr_id"),
                func.min(PRReview.submitted_at).label("first_review_at"),
            )
            .where(PRReview.reviewer_login == self._bot_login)
            .group_by(PRReview.pr_id)
            .subquery()
        )

        q = (
            select(
                func.avg(
                    func.extract("epoch", first_review_sq.c.first_review_at)
                    - func.extract("epoch", PullRequest.created_at)
                ).label("avg_seconds")
            )
            .join(first_review_sq, first_review_sq.c.pr_id == PullRequest.id)
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
        )
        if repo_ids:
            q = q.where(PullRequest.repo_id.in_(repo_ids))

        result = await self._db.execute(q)
        avg_seconds = result.scalar()
        if avg_seconds is None or float(avg_seconds) <= 0:
            return None
        return round(float(avg_seconds) / 60.0, 1)

    # ------------------------------------------------------------------ #
    # Comments per PR
    # ------------------------------------------------------------------ #

    async def _avg_comments_per_pr(
        self, start_date: datetime, end_date: datetime, repo_ids: list[int] | None
    ) -> float | None:
        """Average number of Greptile comments per PR (only PRs that have Greptile comments)."""
        # Count Greptile comments per PR
        comments_per_pr_sq = (
            select(
                PRComment.pr_id.label("pr_id"),
                func.count(PRComment.id).label("comment_count"),
            )
            .join(PullRequest, PullRequest.id == PRComment.pr_id)
            .where(
                and_(
                    PRComment.author_login == self._bot_login,
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
        )
        if repo_ids:
            comments_per_pr_sq = comments_per_pr_sq.where(
                PullRequest.repo_id.in_(repo_ids)
            )

        comments_per_pr_sq = comments_per_pr_sq.group_by(PRComment.pr_id).subquery()

        q = select(func.avg(comments_per_pr_sq.c.comment_count))
        result = await self._db.execute(q)
        avg = result.scalar()
        if avg is None:
            return None
        return round(float(avg), 1)

    # ------------------------------------------------------------------ #
    # Index health
    # ------------------------------------------------------------------ #

    async def _index_health(self, repo_ids: list[int] | None) -> dict:
        """Compare GitHub repos with Greptile indexed repos."""
        # GitHub repos
        github_q = select(Repository.id, Repository.full_name)
        if repo_ids:
            github_q = github_q.where(Repository.id.in_(repo_ids))
        github_result = await self._db.execute(github_q)
        github_repos = {row.full_name: row.id for row in github_result.all()}

        # Greptile repos (keyed by lowercase name for case-insensitive matching)
        greptile_result = await self._db.execute(select(GreptileRepository))
        greptile_rows = greptile_result.scalars().all()
        greptile_by_name: dict[str, GreptileRepository] = {}
        for r in greptile_rows:
            if r.repository:
                greptile_by_name[r.repository.lower()] = r

        # Latest commit SHA per repo
        latest_sha_q = select(
            Commit.repo_id,
            func.max(Commit.committed_at).label("latest_at"),
        ).group_by(Commit.repo_id)
        latest_sha_result = await self._db.execute(latest_sha_q)
        latest_commit_map: dict[int, str] = {}
        for row in latest_sha_result.all():
            # Get the actual SHA for the latest commit
            sha_q = (
                select(Commit.sha)
                .where(
                    and_(
                        Commit.repo_id == row.repo_id,
                        Commit.committed_at == row.latest_at,
                    )
                )
                .limit(1)
            )
            sha_result = await self._db.execute(sha_q)
            sha = sha_result.scalar()
            if sha:
                latest_commit_map[row.repo_id] = sha

        indexed_count = 0
        stale_count = 0
        error_count = 0
        not_found_count = 0
        total_files_processed = 0
        total_files = 0

        for full_name in github_repos:
            greptile_repo = greptile_by_name.get(full_name.lower())
            if greptile_repo is None:
                continue

            status = (greptile_repo.status or "").lower()
            if status in ("failed", "error"):
                error_count += 1
            elif status == "not_found":
                not_found_count += 1  # not an error; repo not in Greptile, can re-index later
            else:
                indexed_count += 1

            # Check staleness
            repo_id = github_repos[full_name]
            latest_sha = latest_commit_map.get(repo_id)
            if latest_sha and greptile_repo.sha and latest_sha != greptile_repo.sha:
                stale_count += 1

            if greptile_repo.files_processed is not None:
                total_files_processed += greptile_repo.files_processed
            if greptile_repo.num_files is not None:
                total_files += greptile_repo.num_files

        return {
            "indexed_repos": indexed_count,
            "total_github_repos": len(github_repos),
            "error_repos": error_count,
            "not_found_repos": not_found_count,
            "stale_repos": stale_count,
            "total_files_processed": total_files_processed,
            "total_files": total_files,
            "file_coverage_pct": (
                round(100.0 * total_files_processed / total_files, 1)
                if total_files > 0
                else None
            ),
        }

    # ------------------------------------------------------------------ #
    # Per-repo breakdown
    # ------------------------------------------------------------------ #

    async def _per_repo_breakdown(
        self, start_date: datetime, end_date: datetime, repo_ids: list[int] | None
    ) -> list[dict]:
        """Per-repo Greptile metrics: index status, review coverage, response time, comments."""
        # GitHub repos
        github_q = select(Repository.id, Repository.full_name)
        if repo_ids:
            github_q = github_q.where(Repository.id.in_(repo_ids))
        github_result = await self._db.execute(github_q)
        github_repos = [(row.id, row.full_name) for row in github_result.all()]

        if not github_repos:
            return []

        # Greptile repos (indexed, keyed by lowercase name for case-insensitive matching)
        greptile_result = await self._db.execute(select(GreptileRepository))
        greptile_rows = greptile_result.scalars().all()
        greptile_by_name: dict[str, GreptileRepository] = {}
        for r in greptile_rows:
            if r.repository:
                greptile_by_name[r.repository.lower()] = r

        # Latest commit SHA per repo
        latest_sha_q = select(
            Commit.repo_id,
            func.max(Commit.committed_at).label("latest_at"),
        ).group_by(Commit.repo_id)
        latest_sha_result = await self._db.execute(latest_sha_q)
        latest_commit_map: dict[int, str] = {}
        for row in latest_sha_result.all():
            sha_q = (
                select(Commit.sha)
                .where(
                    and_(
                        Commit.repo_id == row.repo_id,
                        Commit.committed_at == row.latest_at,
                    )
                )
                .limit(1)
            )
            sha_result = await self._db.execute(sha_q)
            sha = sha_result.scalar()
            if sha:
                latest_commit_map[row.repo_id] = sha

        # PR counts per repo
        total_prs_q = (
            select(PullRequest.repo_id, func.count(PullRequest.id).label("total"))
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
            .group_by(PullRequest.repo_id)
        )
        total_prs_result = await self._db.execute(total_prs_q)
        total_prs_map = {row.repo_id: row.total for row in total_prs_result.all()}

        # Greptile-reviewed PR counts per repo
        reviewed_q = (
            select(
                PullRequest.repo_id,
                func.count(distinct(PullRequest.id)).label("reviewed"),
            )
            .join(PRReview, PRReview.pr_id == PullRequest.id)
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                    PRReview.reviewer_login == self._bot_login,
                )
            )
            .group_by(PullRequest.repo_id)
        )
        reviewed_result = await self._db.execute(reviewed_q)
        reviewed_map = {row.repo_id: row.reviewed for row in reviewed_result.all()}

        # Avg response time per repo
        first_review_sq = (
            select(
                PRReview.pr_id.label("pr_id"),
                func.min(PRReview.submitted_at).label("first_review_at"),
            )
            .where(PRReview.reviewer_login == self._bot_login)
            .group_by(PRReview.pr_id)
            .subquery()
        )
        resp_q = (
            select(
                PullRequest.repo_id,
                func.avg(
                    func.extract("epoch", first_review_sq.c.first_review_at)
                    - func.extract("epoch", PullRequest.created_at)
                ).label("avg_seconds"),
            )
            .join(first_review_sq, first_review_sq.c.pr_id == PullRequest.id)
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
            .group_by(PullRequest.repo_id)
        )
        resp_result = await self._db.execute(resp_q)
        resp_map = {
            row.repo_id: (
                round(float(row.avg_seconds) / 60.0, 1)
                if row.avg_seconds and float(row.avg_seconds) > 0
                else None
            )
            for row in resp_result.all()
        }

        # Avg comments per PR per repo
        comments_q = (
            select(
                PullRequest.repo_id,
                func.count(PRComment.id).label("total_comments"),
                func.count(distinct(PRComment.pr_id)).label("prs_with_comments"),
            )
            .join(PRComment, PRComment.pr_id == PullRequest.id)
            .where(
                and_(
                    PRComment.author_login == self._bot_login,
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
            .group_by(PullRequest.repo_id)
        )
        comments_result = await self._db.execute(comments_q)
        comments_map = {
            row.repo_id: (
                round(row.total_comments / row.prs_with_comments, 1)
                if row.prs_with_comments > 0
                else None
            )
            for row in comments_result.all()
        }

        # Build result
        per_repo = []
        for repo_id, full_name in github_repos:
            greptile_repo = greptile_by_name.get(full_name.lower())
            total = total_prs_map.get(repo_id, 0)
            reviewed = reviewed_map.get(repo_id, 0)

            # Determine index status
            if greptile_repo is None:
                # If the Greptile bot has reviewed PRs on this repo, it's active
                # even if we can't find it in the Greptile index API
                index_status = "active" if reviewed > 0 else "not_indexed"
                file_coverage_pct = None
            else:
                status = (greptile_repo.status or "").lower()
                if status in ("failed", "error"):
                    index_status = "error"
                elif status == "not_found":
                    index_status = "not_found"  # not an error; can filter and re-index later
                else:
                    latest_sha = latest_commit_map.get(repo_id)
                    if (
                        latest_sha
                        and greptile_repo.sha
                        and latest_sha != greptile_repo.sha
                    ):
                        index_status = "stale"
                    else:
                        index_status = "indexed"

                fp = greptile_repo.files_processed or 0
                nf = greptile_repo.num_files or 0
                file_coverage_pct = round(100.0 * fp / nf, 1) if nf > 0 else None

            per_repo.append(
                {
                    "repo_name": full_name,
                    "index_status": index_status,
                    "file_coverage_pct": file_coverage_pct,
                    "review_coverage_pct": (
                        round(100.0 * reviewed / total, 1) if total > 0 else None
                    ),
                    "avg_response_time_minutes": resp_map.get(repo_id),
                    "avg_comments_per_pr": comments_map.get(repo_id),
                    "total_prs": total,
                    "reviewed_prs": reviewed,
                }
            )

        # Sort: repos with issues first (error, not_indexed, not_found), then by coverage ascending
        status_priority = {
            "error": 0,
            "not_indexed": 1,
            "not_found": 2,
            "active": 3,
            "stale": 4,
            "indexed": 5,
        }
        per_repo.sort(
            key=lambda r: (
                status_priority.get(r["index_status"], 9),
                (
                    r["review_coverage_pct"]
                    if r["review_coverage_pct"] is not None
                    else 999
                ),
            )
        )

        return per_repo

    # ------------------------------------------------------------------ #
    # Trend (daily or weekly)
    # ------------------------------------------------------------------ #

    async def _review_trend(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_ids: list[int] | None,
        granularity: str = "week",
    ) -> list[dict]:
        """Review coverage trend grouped by day or week."""
        trunc_unit = "day" if granularity == "day" else "week"
        period_expr = func.date_trunc(trunc_unit, PullRequest.created_at)

        # Total PRs per period
        total_q = (
            select(
                period_expr.label("period"),
                func.count(PullRequest.id).label("total"),
            )
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                )
            )
            .group_by(period_expr)
            .order_by(period_expr)
        )
        if repo_ids:
            total_q = total_q.where(PullRequest.repo_id.in_(repo_ids))

        total_result = await self._db.execute(total_q)
        total_by_period = {
            str(row.period.date()): row.total for row in total_result.all()
        }

        # Reviewed PRs per period
        reviewed_q = (
            select(
                period_expr.label("period"),
                func.count(distinct(PullRequest.id)).label("reviewed"),
            )
            .join(PRReview, PRReview.pr_id == PullRequest.id)
            .where(
                and_(
                    PullRequest.created_at >= start_date,
                    PullRequest.created_at <= end_date,
                    PRReview.reviewer_login == self._bot_login,
                )
            )
            .group_by(period_expr)
            .order_by(period_expr)
        )
        if repo_ids:
            reviewed_q = reviewed_q.where(PullRequest.repo_id.in_(repo_ids))

        reviewed_result = await self._db.execute(reviewed_q)
        reviewed_by_period = {
            str(row.period.date()): row.reviewed for row in reviewed_result.all()
        }

        # Merge — for daily granularity, fill every day in the range so the
        # chart has a continuous x-axis (matching the Cursor chart behaviour).
        if granularity == "day":
            all_periods = []
            current = start_date.date()
            end_d = end_date.date()
            while current <= end_d:
                all_periods.append(str(current))
                current += timedelta(days=1)
        else:
            all_periods = sorted(
                set(list(total_by_period.keys()) + list(reviewed_by_period.keys()))
            )

        trend = []
        for period in all_periods:
            total = total_by_period.get(period, 0)
            reviewed = reviewed_by_period.get(period, 0)
            coverage = round(100.0 * reviewed / total, 1) if total > 0 else 0.0
            trend.append(
                {
                    "week": period,
                    "coverage_pct": coverage,
                    "prs_total": total,
                    "prs_reviewed": reviewed,
                }
            )

        return trend

    # ------------------------------------------------------------------ #
    # Recommendations
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_recommendations(
        review_coverage: dict, index_health: dict, per_repo: list[dict]
    ) -> list[dict]:
        """Generate actionable recommendations from the metrics."""
        recommendations: list[dict] = []

        # 1. Not-indexed repos
        not_indexed = [
            r["repo_name"] for r in per_repo if r["index_status"] == "not_indexed"
        ]
        if not_indexed:
            recommendations.append(
                {
                    "type": "not_indexed",
                    "severity": "warning",
                    "message": f"{len(not_indexed)} repo{'s are' if len(not_indexed) > 1 else ' is'} not indexed in Greptile",
                    "detail": "These repositories won't receive AI code reviews. Index them in Greptile to improve coverage.",
                    "repos": not_indexed,
                    "tags": ["greptile"],
                }
            )

        # 2. Error repos
        error_repos = [r["repo_name"] for r in per_repo if r["index_status"] == "error"]
        if error_repos:
            recommendations.append(
                {
                    "type": "index_error",
                    "severity": "error",
                    "message": f"{len(error_repos)} repo{'s have' if len(error_repos) > 1 else ' has'} indexing errors",
                    "detail": "Re-index these repositories in the Greptile app to fix the errors.",
                    "repos": error_repos,
                    "tags": ["greptile"],
                }
            )

        # 3. Stale indexes
        stale_repos = [r["repo_name"] for r in per_repo if r["index_status"] == "stale"]
        if stale_repos:
            recommendations.append(
                {
                    "type": "stale_index",
                    "severity": "info",
                    "message": f"{len(stale_repos)} repo{'s have' if len(stale_repos) > 1 else ' has'} stale indexes",
                    "detail": "The indexed version differs from the latest commit. Re-index for more accurate reviews.",
                    "repos": stale_repos,
                    "tags": ["greptile", "github"],
                }
            )

        # 4. Low overall review coverage
        coverage = review_coverage["coverage_pct"]
        total_prs = review_coverage["total_prs"]
        if total_prs > 0 and coverage < 80.0:
            recommendations.append(
                {
                    "type": "low_coverage",
                    "severity": "warning" if coverage < 50.0 else "info",
                    "message": f"Overall review coverage is {coverage}%",
                    "detail": "Aim for 80%+ of PRs reviewed by Greptile. Check that Greptile is installed on all repos.",
                    "repos": [],
                    "tags": ["github"],
                }
            )

        # 5. Per-repo low coverage (for repos that are indexed but have low coverage)
        low_coverage_repos = [
            r["repo_name"]
            for r in per_repo
            if r["index_status"] == "indexed"
            and r["total_prs"] >= 3
            and r["review_coverage_pct"] is not None
            and r["review_coverage_pct"] < 50.0
        ]
        if low_coverage_repos:
            recommendations.append(
                {
                    "type": "low_repo_coverage",
                    "severity": "warning",
                    "message": f"{len(low_coverage_repos)} indexed repo{'s have' if len(low_coverage_repos) > 1 else ' has'} less than 50% review coverage",
                    "detail": "These repos are indexed but Greptile isn't reviewing most PRs. Check the GitHub App installation.",
                    "repos": low_coverage_repos,
                    "tags": ["github"],
                }
            )

        # 6. All good!
        if not recommendations and total_prs > 0 and coverage >= 80.0:
            recommendations.append(
                {
                    "type": "all_good",
                    "severity": "success",
                    "message": "Greptile coverage is healthy",
                    "detail": f"{coverage}% of PRs are reviewed by Greptile across {index_health['indexed_repos']} indexed repos.",
                    "repos": [],
                    "tags": ["greptile"],
                }
            )

        return recommendations
