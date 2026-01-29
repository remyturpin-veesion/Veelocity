"""Tests for DORA metrics service - deployment reliability."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.metrics.dora import DORAMetricsService


def _make_run(workflow_id: int, conclusion: str, completed_at: datetime):
    """Create a mock WorkflowRun with required attributes."""
    run = MagicMock()
    run.workflow_id = workflow_id
    run.conclusion = conclusion
    run.completed_at = completed_at
    return run


@pytest.fixture
def mock_db():
    """Mock async DB session that returns configurable workflow runs."""
    db = AsyncMock()
    runs_data = []

    def set_runs(runs):
        nonlocal runs_data
        runs_data = runs

    async def execute(stmt):
        result = MagicMock()
        scalars = MagicMock()
        scalars.all.return_value = list(runs_data)
        result.scalars.return_value = scalars
        return result

    db.execute = AsyncMock(side_effect=execute)
    db.set_runs = set_runs
    return db


@pytest.fixture
def dora_service(mock_db):
    """Create DORAMetricsService with mock DB."""
    return DORAMetricsService(mock_db)


@pytest.mark.asyncio
async def test_deployment_reliability_empty_runs(dora_service, mock_db):
    """When no runs in period, return zeros and stability 100."""
    mock_db.set_runs([])
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await dora_service.get_deployment_reliability(start, end, None)

    assert result["total_runs"] == 0
    assert result["successful_runs"] == 0
    assert result["failed_runs"] == 0
    assert result["cancelled_runs"] == 0
    assert result["failure_rate"] == 0.0
    assert result["mttr_hours"] is None
    assert result["stability_score"] == 100.0


@pytest.mark.asyncio
async def test_deployment_reliability_all_success(dora_service, mock_db):
    """When all runs succeed, failure rate 0, stability 100."""
    base = datetime(2025, 1, 15, 10, 0, 0)
    mock_db.set_runs([
        _make_run(1, "success", base),
        _make_run(1, "success", base.replace(hour=12)),
    ])
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await dora_service.get_deployment_reliability(start, end, None)

    assert result["total_runs"] == 2
    assert result["successful_runs"] == 2
    assert result["failed_runs"] == 0
    assert result["failure_rate"] == 0.0
    assert result["mttr_hours"] is None
    assert result["stability_score"] == 100.0


@pytest.mark.asyncio
async def test_deployment_reliability_mixed_conclusions(dora_service, mock_db):
    """Failure rate and stability reflect success/failure/cancelled."""
    base = datetime(2025, 1, 15, 10, 0, 0)
    mock_db.set_runs([
        _make_run(1, "success", base),
        _make_run(1, "failure", base.replace(hour=11)),
        _make_run(1, "cancelled", base.replace(hour=12)),
    ])
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await dora_service.get_deployment_reliability(start, end, None)

    assert result["total_runs"] == 3
    assert result["successful_runs"] == 1
    assert result["failed_runs"] == 1
    assert result["cancelled_runs"] == 1
    assert result["failure_rate"] == pytest.approx(33.33, abs=0.1)
    assert result["stability_score"] == pytest.approx(66.67, abs=0.1)


@pytest.mark.asyncio
async def test_deployment_reliability_mttr(dora_service, mock_db):
    """MTTR is mean time from failure to next success (same workflow)."""
    base = datetime(2025, 1, 15, 10, 0, 0)
    # Failure at 10:00, next success at 12:00 same workflow -> 2h
    mock_db.set_runs([
        _make_run(1, "failure", base),
        _make_run(1, "success", base.replace(hour=12)),
    ])
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await dora_service.get_deployment_reliability(start, end, None)

    assert result["failed_runs"] == 1
    assert result["mttr_hours"] == 2.0


@pytest.mark.asyncio
async def test_deployment_reliability_mttr_multiple_failures(dora_service, mock_db):
    """MTTR averages recovery times when multiple failures have next success."""
    base = datetime(2025, 1, 15, 10, 0, 0)
    # Fail 10:00 -> success 11:00 (1h); fail 12:00 -> success 15:00 (3h); avg 2h
    mock_db.set_runs([
        _make_run(1, "failure", base),
        _make_run(1, "success", base.replace(hour=11)),
        _make_run(1, "failure", base.replace(hour=12)),
        _make_run(1, "success", base.replace(hour=15)),
    ])
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await dora_service.get_deployment_reliability(start, end, None)

    assert result["mttr_hours"] == 2.0


@pytest.mark.asyncio
async def test_deployment_reliability_mttr_no_recovery(dora_service, mock_db):
    """When failures have no subsequent success, MTTR is None."""
    base = datetime(2025, 1, 15, 10, 0, 0)
    mock_db.set_runs([
        _make_run(1, "failure", base),
        _make_run(1, "failure", base.replace(hour=11)),
    ])
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await dora_service.get_deployment_reliability(start, end, None)

    assert result["failed_runs"] == 2
    assert result["mttr_hours"] is None
