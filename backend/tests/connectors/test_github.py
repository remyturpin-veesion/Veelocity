import pytest
import respx
from httpx import Response

from app.connectors.github import GitHubConnector


@pytest.fixture
def connector():
    return GitHubConnector(token="test-token", repos=["owner/repo"])


def test_connector_name(connector):
    assert connector.name == "github"


def test_supported_metrics(connector):
    metrics = connector.get_supported_metrics()
    assert "pr_review_time" in metrics
    assert "throughput" in metrics


@pytest.mark.asyncio
@respx.mock
async def test_test_connection_success(connector):
    respx.get("https://api.github.com/user").mock(
        return_value=Response(200, json={"login": "testuser"})
    )
    result = await connector.test_connection()
    assert result is True


@pytest.mark.asyncio
@respx.mock
async def test_test_connection_failure(connector):
    respx.get("https://api.github.com/user").mock(
        return_value=Response(401, json={"message": "Bad credentials"})
    )
    result = await connector.test_connection()
    assert result is False


@pytest.mark.asyncio
@respx.mock
async def test_fetch_repos(connector):
    respx.get("https://api.github.com/repos/owner/repo").mock(
        return_value=Response(200, json={
            "id": 123,
            "name": "repo",
            "full_name": "owner/repo",
            "default_branch": "main",
        })
    )
    repos = await connector.fetch_repos()
    assert len(repos) == 1
    assert repos[0]["full_name"] == "owner/repo"


@pytest.mark.asyncio
@respx.mock
async def test_fetch_pull_requests(connector):
    # Use side_effect to return data on first call, empty on second (pagination)
    responses = iter([
        Response(200, json=[
            {
                "id": 1,
                "number": 42,
                "title": "Test PR",
                "body": "Description",
                "state": "open",
                "draft": False,
                "user": {"login": "dev1", "avatar_url": "https://avatar"},
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-02T00:00:00Z",
                "merged_at": None,
                "closed_at": None,
                "additions": 10,
                "deletions": 5,
                "commits": 3,
            }
        ]),
        Response(200, json=[]),  # Empty page 2 stops pagination
    ])
    respx.get("https://api.github.com/repos/owner/repo/pulls").mock(
        side_effect=lambda request: next(responses)
    )
    prs = await connector.fetch_pull_requests("owner/repo")
    assert len(prs) == 1
    assert prs[0]["number"] == 42
    assert prs[0]["author_login"] == "dev1"


@pytest.mark.asyncio
@respx.mock
async def test_fetch_reviews(connector):
    respx.get("https://api.github.com/repos/owner/repo/pulls/42/reviews").mock(
        return_value=Response(200, json=[
            {
                "id": 100,
                "user": {"login": "reviewer1"},
                "state": "APPROVED",
                "submitted_at": "2025-01-02T10:00:00Z",
            }
        ])
    )
    reviews = await connector.fetch_reviews("owner/repo", 42)
    assert len(reviews) == 1
    assert reviews[0]["reviewer_login"] == "reviewer1"
    assert reviews[0]["state"] == "approved"


@pytest.mark.asyncio
@respx.mock
async def test_fetch_comments(connector):
    respx.get("https://api.github.com/repos/owner/repo/pulls/42/comments").mock(
        return_value=Response(200, json=[
            {
                "id": 200,
                "user": {"login": "dev2"},
                "body": "Looks good",
                "created_at": "2025-01-02T11:00:00Z",
            }
        ])
    )
    comments = await connector.fetch_comments("owner/repo", 42)
    assert len(comments) == 1
    assert comments[0]["author_login"] == "dev2"


@pytest.mark.asyncio
@respx.mock
async def test_fetch_pr_commits(connector):
    respx.get("https://api.github.com/repos/owner/repo/pulls/42/commits").mock(
        return_value=Response(200, json=[
            {
                "sha": "abc123",
                "commit": {
                    "author": {"name": "Dev", "date": "2025-01-01T08:00:00Z"},
                    "message": "Initial commit",
                },
                "author": {"login": "dev1"},
            }
        ])
    )
    commits = await connector.fetch_pr_commits("owner/repo", 42)
    assert len(commits) == 1
    assert commits[0]["sha"] == "abc123"
    assert commits[0]["author_login"] == "dev1"
