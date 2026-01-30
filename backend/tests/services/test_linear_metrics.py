"""Tests for Linear metrics service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.metrics.linear_metrics import LinearMetricsService


def _make_mock_db(
    completed_dates=None,
    backlog_count=0,
    time_in_state_rows=None,
    workflow_state_rows=None,
    state_count_rows=None,
):
    """Create a mock DB for Linear metrics. get_time_in_state calls: workflow states, count by state, time query."""
    completed_dates = completed_dates or []
    time_in_state_rows = time_in_state_rows or []
    workflow_state_rows = workflow_state_rows or [("Todo", 0.0), ("In Progress", 1.0), ("Done", 2.0)]
    state_count_rows = state_count_rows or [("Todo", 5), ("In Progress", 3), ("Done", 2)]
    call_order = [0]

    async def execute(stmt):
        result = MagicMock()
        idx = call_order[0]
        call_order[0] += 1
        stmt_str = str(stmt).lower()
        if "linear_workflow_states" in stmt_str:
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(return_value=workflow_state_rows)
        elif ("group by" in stmt_str or "group_by" in stmt_str) and "state" in stmt_str:
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(return_value=state_count_rows)
        elif "count(" in stmt_str and "linear" in stmt_str:
            result.scalar = MagicMock(return_value=backlog_count)
            result.all = MagicMock(return_value=[])
        elif "started_at" in stmt_str and "completed_at" in stmt_str and "created_at" in stmt_str:
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(return_value=time_in_state_rows)
        else:
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(return_value=[(d,) for d in completed_dates])
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
                datetime(2025, 1, 1, 0, 0),
                datetime(2025, 1, 8, 10, 0),
                datetime(2025, 1, 10, 14, 0),
            ),
            (
                datetime(2025, 1, 5, 0, 0),
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
    """Returns workflow state columns in order and overall time-in-state for completed issues."""
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)

    result = await linear_service.get_time_in_state(start, end)

    assert result["count"] == 2
    assert result["average_hours"] > 0
    assert result["median_hours"] > 0
    assert "min_hours" in result
    assert "max_hours" in result
    assert "start_date" in result
    assert "end_date" in result
    assert "stages" in result
    stages = result["stages"]
    assert len(stages) >= 3
    todo = next(s for s in stages if s["id"] == "todo")
    in_progress = next(s for s in stages if s["id"] == "in_progress")
    done = next(s for s in stages if s["id"] == "done")
    assert todo["label"] == "Todo" and todo["count"] == 5
    assert in_progress["label"] == "In Progress" and in_progress["count"] == 3
    assert done["label"] == "Done" and done["count"] == 2
    backlog = next(s for s in stages if s["id"] == "time_backlog")
    total = next(s for s in stages if s["id"] == "time_total")
    assert backlog["count"] == 2 and backlog["median_hours"] >= 0
    assert total["count"] == 2 and total["median_hours"] >= 0


@pytest.mark.asyncio
async def test_get_time_in_state_empty():
    """When no completed issues, overall is zero; stages still from workflow states."""
    db = _make_mock_db(
        time_in_state_rows=[],
        workflow_state_rows=[("Todo", 0.0), ("Done", 1.0)],
        state_count_rows=[("Todo", 1), ("Done", 0)],
    )
    service = LinearMetricsService(db)
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)
    result = await service.get_time_in_state(start, end)
    assert result["count"] == 0
    assert result["average_hours"] == 0.0
    assert result["median_hours"] == 0.0
    assert result["stages"] is not None
    assert len(result["stages"]) == 5  # 2 workflow + Backlog, In progress, Total


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
