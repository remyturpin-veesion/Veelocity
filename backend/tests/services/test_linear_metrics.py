"""Tests for Linear metrics service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.metrics.linear_metrics import LinearMetricsService


def _make_mock_db(completed_dates=None, backlog_count=0, time_in_state_rows=None):
    """Create a mock DB that returns configurable results for Linear metrics queries.
    get_overview calls get_issues_completed (1 execute), get_backlog (1 execute),
    get_time_in_state (1 execute). We return results in that order per execute call.
    """
    completed_dates = completed_dates or []
    time_in_state_rows = time_in_state_rows or []
    call_order = [0]

    async def execute(stmt):
        result = MagicMock()
        idx = call_order[0]
        call_order[0] += 1
        stmt_str = str(stmt).lower()
        if "count(" in stmt_str and "linear" in stmt_str:
            result.scalar = MagicMock(return_value=backlog_count)
            result.all = MagicMock(return_value=[])
        elif "started_at" in stmt_str and "completed_at" in stmt_str:
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(return_value=time_in_state_rows)
        else:
            # issues completed: list of (completed_at,)
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(
                return_value=[(d,) for d in completed_dates]
            )
        return result

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=execute)
    return db


@pytest.fixture
def linear_service():
    """Create LinearMetricsService with mock DB."""
    db = _make_mock_db(
        completed_dates=[
            datetime(2025, 1, 10, 12, 0),
            datetime(2025, 1, 15, 12, 0),
        ],
        backlog_count=7,
        time_in_state_rows=[
            (
                datetime(2025, 1, 8, 10, 0),
                datetime(2025, 1, 10, 14, 0),
            ),
            (
                datetime(2025, 1, 12, 9, 0),
                datetime(2025, 1, 15, 11, 0),
            ),
        ],
    )
    return LinearMetricsService(db)


@pytest.mark.asyncio
async def test_get_issues_completed_empty(linear_service):
    """When no issues completed in period, total and average are 0."""
    db = _make_mock_db(completed_dates=[], backlog_count=0, time_in_state_rows=[])
    service = LinearMetricsService(db)
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await service.get_issues_completed(start, end, period="week")

    assert result["total"] == 0
    assert result["average"] == 0
    assert result["data"] == []
    assert result["period"] == "week"


@pytest.mark.asyncio
async def test_get_issues_completed_with_data(linear_service):
    """Counts completed dates and groups by period."""
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await linear_service.get_issues_completed(
        start, end, period="week"
    )

    assert result["total"] == 2
    assert result["period"] == "week"
    assert len(result["data"]) >= 1
    assert "start_date" in result
    assert "end_date" in result


@pytest.mark.asyncio
async def test_get_backlog(linear_service):
    """Returns backlog count from mock."""
    result = await linear_service.get_backlog()

    assert result["backlog_count"] == 7


@pytest.mark.asyncio
async def test_get_backlog_empty():
    """When no open issues, backlog is 0."""
    db = _make_mock_db(backlog_count=0)
    service = LinearMetricsService(db)
    result = await service.get_backlog()
    assert result["backlog_count"] == 0


@pytest.mark.asyncio
async def test_get_time_in_state(linear_service):
    """Computes average and median from started->completed deltas."""
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await linear_service.get_time_in_state(start, end)

    assert result["count"] == 2
    assert result["average_hours"] > 0
    assert result["median_hours"] > 0
    assert "start_date" in result
    assert "end_date" in result


@pytest.mark.asyncio
async def test_get_time_in_state_empty():
    """When no completed issues with started_at, returns zeros."""
    db = _make_mock_db(time_in_state_rows=[])
    service = LinearMetricsService(db)
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)
    result = await service.get_time_in_state(start, end)
    assert result["count"] == 0
    assert result["average_hours"] == 0.0
    assert result["median_hours"] == 0.0


@pytest.mark.asyncio
async def test_get_overview(linear_service):
    """Overview aggregates issues_completed, backlog, time_in_state."""
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await linear_service.get_overview(start, end)

    assert "issues_completed" in result
    assert "issues_completed_per_week" in result
    assert "backlog_count" in result
    assert result["backlog_count"] == 7
    assert "time_in_state_average_hours" in result
    assert "time_in_state_median_hours" in result
    assert "time_in_state_count" in result
    assert result["start_date"] == start.isoformat()
    assert result["end_date"] == end.isoformat()
