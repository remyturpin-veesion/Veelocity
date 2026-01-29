"""DORA metrics calculation service."""

from collections import Counter
from datetime import datetime
from typing import Literal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github import Commit, Workflow, WorkflowRun


class DORAMetricsService:
    """Calculate DORA metrics from synced data."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_deployment_frequency(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        repo_id: int | None = None,
        author_login: str | None = None,
    ) -> dict:
        """
        Calculate deployment frequency over a period.

        Returns count of successful deployments grouped by period.
        If author_login is specified, only counts deployments where the deployed commit
        was authored by that developer.
        """
        # Get all successful deployments
        query = (
            select(WorkflowRun)
            .join(Workflow)
            .where(
                and_(
                    Workflow.is_deployment == True,  # noqa: E712
                    WorkflowRun.conclusion == "success",
                    WorkflowRun.completed_at >= start_date,
                    WorkflowRun.completed_at <= end_date,
                )
            )
        )

        if repo_id:
            query = query.where(Workflow.repo_id == repo_id)

        result = await self._db.execute(query.order_by(WorkflowRun.completed_at))
        workflow_runs = list(result.scalars().all())

        # Filter by author if specified
        deployments = []
        for run in workflow_runs:
            if author_login:
                # Check if the deployed commit was authored by this developer
                commit_result = await self._db.execute(
                    select(Commit).where(Commit.sha == run.head_sha)
                )
                commit = commit_result.scalar_one_or_none()
                if commit and commit.author_login == author_login:
                    deployments.append(run.completed_at)
            else:
                deployments.append(run.completed_at)

        # Group by period
        grouped = self._group_by_period(deployments, period)

        # Calculate average
        total_deployments = len(deployments)
        period_count = self._count_periods(start_date, end_date, period)
        average = total_deployments / period_count if period_count > 0 else 0

        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "data": grouped,
            "total": total_deployments,
            "average": round(average, 2),
        }

    async def get_deployment_reliability(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
    ) -> dict:
        """
        Calculate deployment reliability metrics.

        - Failure rate: % of deployment runs with conclusion "failure"
        - MTTR: Mean time to recovery (hours from failure to next successful run,
          same workflow). Only computed for failures that have a subsequent success.
        - Stability score: 100 * (1 - failure_rate), 0–100.
        """
        query = (
            select(WorkflowRun)
            .join(Workflow)
            .where(
                and_(
                    Workflow.is_deployment == True,  # noqa: E712
                    WorkflowRun.completed_at >= start_date,
                    WorkflowRun.completed_at <= end_date,
                    WorkflowRun.conclusion.in_(["success", "failure", "cancelled"]),
                )
            )
        )
        if repo_id:
            query = query.where(Workflow.repo_id == repo_id)

        result = await self._db.execute(query.order_by(WorkflowRun.completed_at))
        runs = list(result.scalars().all())

        success_count = sum(1 for r in runs if r.conclusion == "success")
        failure_count = sum(1 for r in runs if r.conclusion == "failure")
        cancelled_count = sum(1 for r in runs if r.conclusion == "cancelled")
        total_completed = success_count + failure_count + cancelled_count

        if total_completed == 0:
            return {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_runs": 0,
                "successful_runs": 0,
                "failed_runs": 0,
                "cancelled_runs": 0,
                "failure_rate": 0.0,
                "mttr_hours": None,
                "stability_score": 100.0,
            }

        failure_rate = (failure_count / total_completed) * 100
        stability_score = 100.0 * (1 - failure_count / total_completed)

        # MTTR: for each failed run, find next successful run (same workflow)
        recovery_times: list[float] = []
        failed_runs = [r for r in runs if r.conclusion == "failure" and r.completed_at]
        success_by_workflow: dict[int, list[tuple[datetime, WorkflowRun]]] = {}
        for r in runs:
            if r.conclusion == "success" and r.completed_at:
                success_by_workflow.setdefault(r.workflow_id, []).append(
                    (r.completed_at, r)
                )
        for wf_id, pairs in success_by_workflow.items():
            pairs.sort(key=lambda x: x[0])

        for run in failed_runs:
            t_fail = run.completed_at
            wf_id = run.workflow_id
            next_successes = success_by_workflow.get(wf_id, [])
            next_success = next(
                (t for t, _ in next_successes if t > t_fail), None
            )
            if next_success:
                recovery_seconds = (next_success - t_fail).total_seconds()
                recovery_times.append(recovery_seconds / 3600)

        mttr_hours: float | None = None
        if recovery_times:
            mttr_hours = round(sum(recovery_times) / len(recovery_times), 2)

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_runs": total_completed,
            "successful_runs": success_count,
            "failed_runs": failure_count,
            "cancelled_runs": cancelled_count,
            "failure_rate": round(failure_rate, 2),
            "mttr_hours": mttr_hours,
            "stability_score": round(stability_score, 2),
        }

    async def get_lead_time_for_changes(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        author_login: str | None = None,
    ) -> dict:
        """
        Calculate lead time for changes.

        Lead time = time from first commit on PR to deployment containing that commit.

        Strategy:
        1. Get successful deployments in range
        2. For each deployment, find the PR that contains the deployed commit (head_sha)
        3. Find the first commit on that PR
        4. Lead time = deployment time - first commit time
        
        If author_login is specified, only includes deployments of commits by that author.
        """
        # Get successful deployments
        deploy_query = (
            select(WorkflowRun)
            .join(Workflow)
            .where(
                and_(
                    Workflow.is_deployment == True,  # noqa: E712
                    WorkflowRun.conclusion == "success",
                    WorkflowRun.completed_at >= start_date,
                    WorkflowRun.completed_at <= end_date,
                )
            )
        )

        if repo_id:
            deploy_query = deploy_query.where(Workflow.repo_id == repo_id)

        result = await self._db.execute(deploy_query)
        deployments = result.scalars().all()

        lead_times = []

        for deployment in deployments:
            # Find commit by sha
            commit_result = await self._db.execute(
                select(Commit).where(Commit.sha == deployment.head_sha)
            )
            commit = commit_result.scalar_one_or_none()

            if not commit or not commit.pr_id:
                continue

            # If filtering by author, check commit author
            if author_login and commit.author_login != author_login:
                continue

            # Find first commit on the PR
            first_commit_result = await self._db.execute(
                select(Commit)
                .where(Commit.pr_id == commit.pr_id)
                .order_by(Commit.committed_at)
                .limit(1)
            )
            first_commit = first_commit_result.scalar_one_or_none()

            if first_commit and deployment.completed_at:
                lead_time = (
                    deployment.completed_at - first_commit.committed_at
                ).total_seconds()
                lead_times.append(
                    {
                        "deployment_id": deployment.id,
                        "first_commit_at": first_commit.committed_at.isoformat(),
                        "deployed_at": deployment.completed_at.isoformat(),
                        "lead_time_seconds": lead_time,
                        "lead_time_hours": round(lead_time / 3600, 2),
                    }
                )

        # Calculate statistics
        if lead_times:
            times = [lt["lead_time_hours"] for lt in lead_times]
            avg_hours = sum(times) / len(times)
            sorted_times = sorted(times)
            median_hours = sorted_times[len(sorted_times) // 2]
        else:
            avg_hours = 0
            median_hours = 0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "measurements": lead_times,
            "count": len(lead_times),
            "average_hours": round(avg_hours, 2),
            "median_hours": round(median_hours, 2),
        }

    async def get_lead_time_by_period(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        repo_id: int | None = None,
        author_login: str | None = None,
    ) -> list[dict]:
        """
        Lead time median per period (for correlation analysis).

        Returns list of {"period": str, "median_hours": float} sorted by period.
        """
        from datetime import datetime as dt

        result = await self.get_lead_time_for_changes(
            start_date, end_date, repo_id, author_login
        )
        measurements = result.get("measurements") or []

        def get_period_key(iso_str: str) -> str:
            try:
                d = dt.fromisoformat(iso_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                return ""
            if period == "day":
                return d.strftime("%Y-%m-%d")
            if period == "week":
                return d.strftime("%Y-W%W")
            return d.strftime("%Y-%m")

        by_period: dict[str, list[float]] = {}
        for m in measurements:
            key = get_period_key(m.get("deployed_at") or "")
            if not key:
                continue
            hours = m.get("lead_time_hours")
            if hours is None:
                continue
            by_period.setdefault(key, []).append(float(hours))

        out = []
        for key in sorted(by_period.keys()):
            times = sorted(by_period[key])
            median = times[len(times) // 2] if times else 0.0
            out.append({"period": key, "median_hours": round(median, 2)})
        return out

    def _group_by_period(
        self, dates: list[datetime], period: Literal["day", "week", "month"]
    ) -> list[dict]:
        """Group dates by period and count."""

        def get_period_key(dt: datetime) -> str:
            if period == "day":
                return dt.strftime("%Y-%m-%d")
            elif period == "week":
                # ISO week
                return dt.strftime("%Y-W%W")
            else:  # month
                return dt.strftime("%Y-%m")

        counts = Counter(get_period_key(dt) for dt in dates if dt)
        return [{"period": k, "count": v} for k, v in sorted(counts.items())]

    def _count_periods(
        self, start: datetime, end: datetime, period: Literal["day", "week", "month"]
    ) -> int:
        """Count number of periods between two dates."""
        delta = end - start
        if period == "day":
            return max(1, delta.days)
        elif period == "week":
            return max(1, delta.days // 7)
        else:  # month
            return max(1, delta.days // 30)
