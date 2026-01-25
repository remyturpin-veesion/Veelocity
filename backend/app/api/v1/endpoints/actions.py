"""GitHub Actions API endpoints."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.github import Workflow, WorkflowRun
from app.schemas.pagination import (
    PaginatedResponse,
    PaginationParams,
    get_pagination_params,
)

router = APIRouter(prefix="/actions", tags=["github-actions"])


@router.get("/workflows", response_model=PaginatedResponse[dict[str, Any]])
async def get_workflows(
    is_deployment: bool | None = None,
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List all workflows, optionally filtered by is_deployment flag."""
    query = select(Workflow)
    count_query = select(func.count(Workflow.id))

    if is_deployment is not None:
        query = query.where(Workflow.is_deployment == is_deployment)
        count_query = count_query.where(Workflow.is_deployment == is_deployment)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(Workflow.name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    workflows = result.scalars().all()

    items = [
        {
            "id": wf.id,
            "github_id": wf.github_id,
            "name": wf.name,
            "path": wf.path,
            "state": wf.state,
            "is_deployment": wf.is_deployment,
        }
        for wf in workflows
    ]
    return PaginatedResponse.create(items, total, pagination)


@router.get("/workflows/{workflow_id}/runs", response_model=PaginatedResponse[dict[str, Any]])
async def get_workflow_runs(
    workflow_id: int,
    conclusion: str | None = None,
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List runs for a workflow, optionally filtered by conclusion."""
    query = select(WorkflowRun).where(WorkflowRun.workflow_id == workflow_id)
    count_query = select(func.count(WorkflowRun.id)).where(
        WorkflowRun.workflow_id == workflow_id
    )

    if conclusion is not None:
        query = query.where(WorkflowRun.conclusion == conclusion)
        count_query = count_query.where(WorkflowRun.conclusion == conclusion)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(WorkflowRun.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    runs = result.scalars().all()

    items = [
        {
            "id": run.id,
            "github_id": run.github_id,
            "status": run.status,
            "conclusion": run.conclusion,
            "run_number": run.run_number,
            "head_sha": run.head_sha,
            "head_branch": run.head_branch,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
        }
        for run in runs
    ]
    return PaginatedResponse.create(items, total, pagination)


@router.get("/deployments", response_model=PaginatedResponse[dict[str, Any]])
async def get_deployments(
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List successful deployment runs (from workflows marked as deployment)."""
    query = (
        select(WorkflowRun)
        .join(Workflow)
        .where(Workflow.is_deployment == True)  # noqa: E712
        .where(WorkflowRun.conclusion == "success")
    )
    count_query = (
        select(func.count(WorkflowRun.id))
        .join(Workflow)
        .where(Workflow.is_deployment == True)  # noqa: E712
        .where(WorkflowRun.conclusion == "success")
    )

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.options(selectinload(WorkflowRun.workflow))
        .order_by(WorkflowRun.completed_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    runs = result.scalars().all()

    items = [
        {
            "id": run.id,
            "workflow_name": run.workflow.name,
            "run_number": run.run_number,
            "head_sha": run.head_sha,
            "head_branch": run.head_branch,
            "completed_at": run.completed_at,
        }
        for run in runs
    ]
    return PaginatedResponse.create(items, total, pagination)
