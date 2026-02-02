"""Tests for Linear metrics service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.metrics.linear_metrics import LinearMetricsService


def _make_mock_db(
    completed_dates=None,
    backlog_count=0,
    started_completed_rows=None,
    workflow_state_rows=None,
    state_count_rows=None,
):
    """Create a mock DB for Linear metrics. get_time_in_state: workflow states (name, position, type), count by state, started_at/completed_at query."""
    completed_dates = completed_dates or []
    started_completed_rows = started_completed_rows or []
    workflow_state_rows = workflow_state_rows or [
        ("Todo", 0.0, "unstarted"),
        ("In Progress", 1.0, "started"),
        ("Done", 2.0, "completed"),
    ]
    state_count_rows = state_count_rows or [("Todo", 5), ("In Progress", 3), ("Done", 2)]
    call_order = [0]

    async def execute(stmt):
        result = MagicMock()
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
        elif "started_at" in stmt_str and "completed_at" in stmt_str:
            result.scalar = MagicMock(return_value=None)
            result.all = MagicMock(return_value=started_completed_rows)
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
        started_completed_rows=[
            (datetime(2025, 1, 8, 10, 0), datetime(2025, 1, 10, 14, 0)),
            (datetime(2025, 1, 12, 9, 0), datetime(2025, 1, 15, 11, 0)),
        ],
    )
    return LinearMetricsService(db)


@pytest.mark.asyncio
async def test_get_issues_completed_empty(linear_service):
    """When no issues completed in period, total and average are 0."""
    db = _make_mock_db(completed_dates=[], backlog_count=0, started_completed_rows=[])
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
    """Returns one card per workflow state; 'started' state has time stats from completed issues."""
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
    assert len(stages) == 3
    todo = next(s for s in stages if s["id"] == "todo")
    in_progress = next(s for s in stages if s["id"] == "in_progress")
    done = next(s for s in stages if s["id"] == "done")
    assert todo["label"] == "Todo" and todo["count"] == 5
    assert in_progress["label"] == "In Progress" and in_progress["count"] == 2
    assert in_progress["median_hours"] > 0 and in_progress["min_hours"] > 0
    assert done["label"] == "Done" and done["count"] == 2


@pytest.mark.asyncio
async def test_get_time_in_state_only_in_progress_gets_time_stats():
    """Only the 'In Progress' / 'Started' state (by name) gets time stats; other states get zeros."""
    # Linear can set type 'started' on many states (In Review, Merged, etc.); we must not
    # duplicate the same median/min/max to every such state.
    db = _make_mock_db(
        started_completed_rows=[
            (datetime(2025, 1, 8, 10, 0), datetime(2025, 1, 10, 14, 0)),
        ],
        workflow_state_rows=[
            ("In Review", 1.0, "started"),
            ("Merged", 2.0, "started"),
            ("In Progress", 1.5, "started"),
            ("Blocked", 2.5, "started"),
        ],
        state_count_rows=[
            ("In Review", 10),
            ("Merged", 20),
            ("In Progress", 5),
            ("Blocked", 8),
        ],
    )
    service = LinearMetricsService(db)
    start = datetime(2025, 1, 1)
    end = datetime(2025, 1, 31)
    result = await service.get_time_in_state(start, end)
    stages = {s["id"]: s for s in result["stages"]}
    # Only "In Progress" (by name) gets non-zero time stats
    assert stages["in_progress"]["median_hours"] > 0
    assert stages["in_progress"]["min_hours"] > 0
    assert stages["in_progress"]["max_hours"] > 0
    assert stages["in_review"]["median_hours"] == 0.0
    assert stages["merged"]["median_hours"] == 0.0
    assert stages["blocked"]["median_hours"] == 0.0
    # Counts come from state counts for non-In-Progress, and from started_stats for In Progress
    assert stages["in_review"]["count"] == 10
    assert stages["merged"]["count"] == 20
    assert stages["blocked"]["count"] == 8


@pytest.mark.asyncio
async def test_get_time_in_state_empty():
    """When no completed issues, overall is zero; stages from workflow states only."""
    db = _make_mock_db(
        started_completed_rows=[],
        workflow_state_rows=[("Todo", 0.0, "unstarted"), ("Done", 1.0, "completed")],
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
    assert len(result["stages"]) == 2


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
