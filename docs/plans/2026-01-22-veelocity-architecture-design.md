# Veelocity Architecture Design

**Date:** 2026-01-22
**Status:** Approved

---

## Overview

Veelocity is a personal developer analytics tool measuring DORA metrics and team performance.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11 + FastAPI |
| Frontend | Flutter (Web, iOS, Android) |
| Database | PostgreSQL 15 |
| Background tasks | FastAPI BackgroundTasks + APScheduler |
| Deployment | Single Docker container |

### What's NOT included (by design)

- No Redis/caching layer
- No Celery workers
- No Kubernetes
- No user authentication
- No multi-tenancy/organizations

### Configuration

- All credentials via environment variables (`.env`)
- Deployment detection patterns configurable
- No UI for settings management

### Data Sync Strategy

- Sync on server startup
- Periodic sync via APScheduler (configurable interval)
- Manual sync trigger via API/UI button
- Recent data fetched on-demand for freshness

---

## Data Model

**Core principle:** No User/Organization layer. All data belongs to the single instance.

### GitHub Models

```
Repository
├── id, github_id, name, full_name, default_branch
└── created_at, updated_at

PullRequest
├── id, github_id, repo_id, number
├── title, body, state, draft
├── author_login, author_avatar
├── created_at, updated_at, merged_at, closed_at
└── additions, deletions, commits_count

PRReview
├── id, github_id, pr_id
├── reviewer_login, state (approved/changes_requested/commented)
└── submitted_at

PRComment
├── id, github_id, pr_id
├── author_login, body
└── created_at

Commit
├── id, sha, repo_id, pr_id (nullable)
├── author_login, message
└── committed_at
```

### GitHub Actions Models

```
Workflow
├── id, github_id, repo_id
├── name, path, state
└── is_deployment (bool, based on name pattern)

WorkflowRun
├── id, github_id, workflow_id
├── status, conclusion, run_number
├── head_sha, head_branch
└── started_at, completed_at
```

### Linear Models

```
LinearTeam
├── id, linear_id, name, key
└── created_at

LinearIssue
├── id, linear_id, team_id
├── identifier (e.g., "ENG-123"), title
├── state, priority, assignee_name
├── created_at, started_at, completed_at, canceled_at
└── linked_pr_id (nullable, for cycle time)
```

### PR to Issue Linking Strategy

- Parse branch names (e.g., `feature/ENG-123-description`)
- Parse PR title/body for issue identifiers
- Store `linked_pr_id` on LinearIssue when match found

---

## Connector Architecture

```python
class BaseConnector(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def test_connection(self) -> bool: ...

    @abstractmethod
    async def sync_all(self) -> SyncResult: ...

    @abstractmethod
    async def sync_recent(self, since: datetime) -> SyncResult: ...

    @abstractmethod
    def get_supported_metrics(self) -> list[str]: ...
```

### Implementations

- `GitHubConnector` - repos, PRs, reviews, comments, commits
- `GitHubActionsConnector` - workflows, runs (shares GitHub token)
- `LinearConnector` - teams, issues

---

## Metrics Calculation

### DORA Metrics (v0.3)

| Metric | Calculation | Data source |
|--------|-------------|-------------|
| Deployment Frequency | Count of workflow runs where `workflow.is_deployment=true` and `conclusion=success`, grouped by period | WorkflowRun |
| Lead Time for Changes | Time from first commit on PR branch to successful deployment containing that PR | Commit → PR → WorkflowRun |

**Lead Time logic:**
1. Find deployment runs (successful, is_deployment=true)
2. Get the commit SHA deployed (`head_sha`)
3. Trace back to PR that contained this commit
4. Find first commit on that PR
5. Lead time = deployment time - first commit time

### Development Metrics (v0.4)

| Metric | Calculation | Data source |
|--------|-------------|-------------|
| PR Review Time | Time from PR opened to first review | PullRequest → PRReview |
| PR Merge Time | Time from PR opened to merged | PullRequest |
| Cycle Time | Time from issue created to linked PR merged | LinearIssue → PullRequest |
| Throughput | Count of PRs merged / issues completed per period | PullRequest, LinearIssue |

### API Response Format Example

```json
{
  "deployment_frequency": {
    "period": "week",
    "data": [{"date": "2025-01-13", "count": 5}],
    "average": 4.2
  }
}
```

---

## API Structure

```
Health:
  GET  /api/v1/health

Connectors:
  GET  /api/v1/connectors/status          # All connectors status
  POST /api/v1/connectors/sync            # Trigger full sync
  POST /api/v1/connectors/sync/recent     # Sync recent data only

GitHub:
  GET  /api/v1/github/repos
  GET  /api/v1/github/repos/{id}/prs
  GET  /api/v1/github/prs/{id}            # PR with reviews, comments

GitHub Actions:
  GET  /api/v1/actions/workflows
  GET  /api/v1/actions/deployments

Linear:
  GET  /api/v1/linear/teams
  GET  /api/v1/linear/issues

Metrics:
  GET  /api/v1/metrics/dora               # All DORA metrics
  GET  /api/v1/metrics/dora/deployment-frequency
  GET  /api/v1/metrics/dora/lead-time
  GET  /api/v1/metrics/development        # All dev metrics
  GET  /api/v1/metrics/development/pr-review-time
  GET  /api/v1/metrics/development/cycle-time
  GET  /api/v1/metrics/development/throughput

Query params: ?start_date=&end_date=&repo_id=&period=(day|week|month)
```

---

## Frontend

### Flutter Screens

1. **Dashboard** - KPI cards (4 metrics), period selector, sync button
2. **DORA Metrics** - Detailed charts for deployment frequency, lead time
3. **Development Metrics** - PR review time, cycle time, throughput charts
4. **Settings** - Connector status, manual sync trigger

### State Management

Riverpod for all API data and UI state.

---

## Project Structure

```
veelocity/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # health, connectors, github, metrics
│   │   ├── connectors/           # base, github, github_actions, linear
│   │   ├── core/                 # config, database
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   ├── services/
│   │   │   ├── metrics/          # dora.py, development.py
│   │   │   └── sync.py           # Sync orchestration
│   │   └── main.py
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── lib/
│       ├── models/
│       ├── services/             # api_service, metrics_service
│       ├── screens/              # dashboard, dora, development, settings
│       ├── widgets/              # kpi_card, charts, period_selector
│       └── main.dart
├── infra/docker/
│   ├── docker-compose.yml        # postgres + backend only
│   └── .env.example
└── Makefile
```

---

## Version Plan

| Version | Deliverables |
|---------|--------------|
| **v0.1** | FastAPI skeleton, Flutter skeleton, PostgreSQL, Docker Compose, health endpoint |
| **v0.2** | GitHub connector, PR/Commit/Review/Comment models, sync mechanism |
| **v0.3** | GitHub Actions connector, Deployment Frequency, Lead Time, basic dashboard |
| **v0.4** | Linear connector, Cycle Time, PR Review Time, Throughput, full dashboard |
| **v0.5** | Polish: charts, trends, filtering, error handling, empty states |

---

## Deferred (not in scope)

- Slack connector and incident tracking
- Change Failure Rate, Mean Time to Recovery
- Multi-user authentication
- Organizations and roles
- Kubernetes deployment
- Mobile build metrics (iOS/Android specific)
