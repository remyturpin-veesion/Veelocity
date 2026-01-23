import pytest
from unittest.mock import AsyncMock, MagicMock


from app.services.sync import SyncService


@pytest.fixture
def mock_connector():
    connector = AsyncMock()
    connector.name = "github"
    connector._repos = ["owner/repo"]
    connector.fetch_repos.return_value = [
        {"github_id": 1, "name": "repo", "full_name": "owner/repo", "default_branch": "main"}
    ]
    connector.fetch_pull_requests.return_value = [
        {
            "github_id": 100,
            "number": 1,
            "title": "Test PR",
            "body": "body",
            "state": "closed",
            "draft": False,
            "author_login": "dev1",
            "author_avatar": None,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-02T00:00:00Z",
            "merged_at": "2025-01-02T12:00:00Z",
            "closed_at": "2025-01-02T12:00:00Z",
            "additions": 10,
            "deletions": 5,
            "commits_count": 2,
        }
    ]
    connector.fetch_reviews.return_value = [
        {"github_id": 200, "reviewer_login": "reviewer1", "state": "approved", "submitted_at": "2025-01-02T10:00:00Z"}
    ]
    connector.fetch_comments.return_value = [
        {"github_id": 300, "author_login": "dev2", "body": "LGTM", "created_at": "2025-01-02T09:00:00Z"}
    ]
    connector.fetch_pr_commits.return_value = [
        {"sha": "abc123", "author_login": "dev1", "message": "feat: add thing", "committed_at": "2025-01-01T08:00:00Z"}
    ]
    return connector


@pytest.fixture
def mock_db():
    """Create a mock database session that properly simulates SQLAlchemy async session."""
    db = AsyncMock()

    # Track added objects and simulate DB state
    added_objects = []
    repo_mock = None
    pr_mock = None

    def track_add(obj):
        nonlocal repo_mock, pr_mock
        added_objects.append(obj)
        # Simulate auto-generated id
        if hasattr(obj, "__tablename__"):
            if obj.__tablename__ == "repositories":
                obj.id = 1
                repo_mock = obj
            elif obj.__tablename__ == "pull_requests":
                obj.id = 1
                pr_mock = obj

    db.add = MagicMock(side_effect=track_add)

    # Create a mock result that returns None (for new inserts) then the object (for lookups)
    call_count = {"repo": 0, "pr": 0}

    async def mock_execute(stmt):
        nonlocal repo_mock, pr_mock
        result = MagicMock()
        # Check what table we're querying based on statement
        stmt_str = str(stmt)
        if "repositories" in stmt_str:
            call_count["repo"] += 1
            # First call returns None (insert), second call returns the object (lookup)
            if call_count["repo"] == 1:
                result.scalar_one_or_none.return_value = None
            else:
                result.scalar_one_or_none.return_value = repo_mock
        elif "pull_requests" in stmt_str:
            call_count["pr"] += 1
            if call_count["pr"] == 1:
                result.scalar_one_or_none.return_value = None
            else:
                result.scalar_one_or_none.return_value = pr_mock
        else:
            # For reviews, comments, commits - always None (new inserts)
            result.scalar_one_or_none.return_value = None
        return result

    db.execute = mock_execute
    db.commit = AsyncMock()
    db.flush = AsyncMock()

    return db


@pytest.mark.asyncio
async def test_sync_all_calls_connector_methods(mock_db, mock_connector):
    """sync_all should fetch repos, PRs, reviews, comments, commits."""
    service = SyncService(mock_db, mock_connector)
    count = await service.sync_all()

    mock_connector.fetch_repos.assert_called_once()
    mock_connector.fetch_pull_requests.assert_called_once_with("owner/repo", state="all")
    mock_connector.fetch_reviews.assert_called_once_with("owner/repo", 1)
    mock_connector.fetch_comments.assert_called_once_with("owner/repo", 1)
    mock_connector.fetch_pr_commits.assert_called_once_with("owner/repo", 1)
    assert count > 0
