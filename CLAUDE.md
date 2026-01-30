# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veelocity is a single-user developer analytics platform measuring DORA metrics and development performance. It syncs data from GitHub, GitHub Actions, and Linear to provide insights on deployment frequency, lead time, PR review time, cycle time, and throughput.

**Key characteristics:**
- Single-user tool (no authentication, no user/org models)
- All credentials via environment variables (`.env`)
- Python 3.11+ backend with FastAPI + PostgreSQL
- Flutter frontend (web, iOS, Android)
- Managed with `uv` (Python package manager)

## Development Setup

### Backend (Python/FastAPI)

```bash
# Start PostgreSQL + backend via Docker
make dev

# Start backend locally with hot reload (requires .env in backend/)
make dev-local  # or: cd backend && uv run uvicorn app.main:app --reload

# Start only PostgreSQL (for local backend dev)
make db

# Run tests
make test  # or: cd backend && uv run pytest -v

# Run specific test file
cd backend && uv run pytest tests/services/test_sync.py -v

# Database migrations
make migrate                           # Apply pending migrations
make migrate-create name="description" # Create new migration

# Linting/Formatting
make lint    # Ruff check
make format  # Black format
```

### Frontend (Flutter)

```bash
cd frontend
flutter pub get          # Install dependencies
flutter run -d chrome    # Run web app
flutter test            # Run tests
dart format .           # Format code
```

### Docker

```bash
make down   # Stop all containers
make logs   # View container logs
```

## Architecture

### No Authentication
Single-user tool. No User/Organization models, no JWT, no sessions.

### Credentials Management
All API tokens (GitHub, Linear) configured via `.env` file, not through UI:
- `GITHUB_TOKEN`
- `GITHUB_REPOS` (comma-separated: "owner/repo1,owner/repo2")
- `LINEAR_API_KEY` — use the Veesion Linear workspace API key (Linear → Settings → API)
- `LINEAR_WORKSPACE_NAME` — optional display name (e.g. `"Veesion Linear"`) shown in connector status and Data Coverage
- `DEPLOYMENT_PATTERNS` (comma-separated: "deploy,release,publish")

### Sync Architecture

**Hybrid sync strategy:**
1. Initial sync on server startup (background, non-blocking)
2. Periodic sync via APScheduler (every 1 hour)
3. Detail filling (reviews/comments/commits) every 10 minutes
4. Manual sync via API/UI

**Smart sync behavior:**
- First run: Fast sync (PRs only, no details) for repos without data
- Subsequent runs: Incremental sync (only updated items since last sync)
- Background detail filling: Gradually fetches reviews/comments/commits in batches

**Error isolation:**
- Each repo sync is isolated - one failure doesn't block others
- Per-connector error handling - GitHub failure doesn't block Linear
- Commits after each repo to preserve progress

**Key implementation:**
- `app/services/scheduler.py` - orchestrates sync jobs
- `app/services/sync.py` - SyncService handles upsert logic
- `app/connectors/base.py` - BaseConnector ABC defines interface
- All sync operations are async

### Connector Pattern

All data source integrations implement `BaseConnector`:

```python
class BaseConnector(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def test_connection(self) -> bool: ...

    @abstractmethod
    async def sync_all(self, db) -> SyncResult: ...

    @abstractmethod
    async def sync_recent(self, db, since: datetime) -> SyncResult: ...

    @abstractmethod
    def get_supported_metrics(self) -> list[str]: ...
```

**Current connectors:**
- `GitHubConnector` - repos, PRs, reviews, comments, commits
- `GitHubActionsConnector` - workflows, runs (for deployments)
- `LinearConnector` - teams, issues (for cycle time)

**Connector factory:** `app/connectors/factory.py` creates connector instances

### Deployment Detection

Deployments are detected from GitHub Actions workflows matching configurable patterns.

**Configuration:** `DEPLOYMENT_PATTERNS` env var (default: "deploy,release,publish")

**Logic:** `app/core/config.py:is_deployment_workflow()` - checks if workflow name/path contains patterns

### Frontend State Management

**Riverpod providers** (see `frontend/lib/services/providers.dart`):
- `selectedPeriodProvider` - time period filter (7/14/30/90 days)
- `selectedRepoIdsProvider` - multi-select repos (empty = all)
- `selectedDeveloperLoginsProvider` - multi-select developers (empty = all)
- Metric providers auto-refresh when filters change

**Navigation:**
- `go_router` for routing (`frontend/lib/core/router.dart`)
- `MainTab` enum for top-level tabs (dashboard, team)

## Code Conventions

### Python (Backend)

- **Async everywhere:** All I/O operations use `async/await`
- **Type hints required:** Use Python 3.11+ type syntax (`list[str]`, `dict[str, Any]`, `int | None`)
- **Docstrings:** Google style for public APIs
- **Formatting:** `black` (line length 88)
- **Linting:** `ruff`
- **Testing:** `pytest` + `pytest-asyncio` (asyncio_mode = "auto")

**Test setup:**
- `backend/tests/conftest.py` - shared fixtures (async client)
- Use `respx` for mocking HTTP calls

### Dart (Frontend)

- **State:** Riverpod (ConsumerWidget, ref.watch/read)
- **HTTP:** `dio` package (`frontend/lib/services/api_service.dart`)
- **Charts:** `fl_chart` package
- **Formatting:** `dart format`

### Git Commits

Format: `type(scope): message`

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`

**Examples:**
- `feat(metrics): add PR review time calculation`
- `fix(sync): handle missing PR details gracefully`
- `refactor(connector): extract common rate limiting logic`

## Database

- **PostgreSQL 15** (port 5433 in dev to avoid conflicts)
- **ORM:** SQLAlchemy 2.0 async
- **Migrations:** Alembic
- **Schema:** All models in `backend/app/models/`
  - `github.py` - Repository, PullRequest, PRReview, PRComment, Commit
  - `linear.py` - LinearTeam, LinearIssue
  - `sync.py` - SyncState

**Timestamp handling:**
- All timestamps stored as `TIMESTAMP WITHOUT TIME ZONE` (naive datetime)
- `_parse_datetime()` in `sync.py` strips timezone info

## Metrics

### DORA Metrics

| Metric | Calculation | Source |
|--------|-------------|--------|
| Deployment Frequency | Count of deployments per period | GitHub Actions (workflow pattern matching) |
| Lead Time for Changes | Time from first commit to deployment | GitHub commits + Actions runs |

### Development Metrics

| Metric | Calculation | Source |
|--------|-------------|--------|
| PR Review Time | Time from PR opened to first review | GitHub PR reviews |
| PR Merge Time | Time from PR opened to merged | GitHub PRs |
| Cycle Time | Time from issue created to PR merged | Linear issues + GitHub PRs (via linking) |
| Throughput | Count of merged PRs per period | GitHub PRs |

**Implementation:**
- `backend/app/services/metrics/dora.py` - DORA metrics
- `backend/app/services/metrics/development.py` - dev metrics
- `backend/app/services/metrics/developers.py` - per-developer breakdowns

## Project Structure

```
veelocity/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # FastAPI routes
│   │   ├── connectors/           # Data source integrations
│   │   │   ├── base.py           # BaseConnector ABC
│   │   │   ├── github.py
│   │   │   ├── github_actions.py
│   │   │   ├── linear.py
│   │   │   ├── factory.py        # Connector factory
│   │   │   └── rate_limiter.py   # API rate limiting
│   │   ├── core/
│   │   │   ├── config.py         # Settings (env vars)
│   │   │   └── database.py       # SQLAlchemy setup
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   ├── services/
│   │   │   ├── metrics/          # Metric calculations
│   │   │   ├── sync.py           # Sync orchestration
│   │   │   ├── scheduler.py      # APScheduler jobs
│   │   │   └── linking.py        # Link PRs to issues
│   │   └── main.py               # FastAPI app + lifespan
│   ├── tests/
│   ├── alembic/                  # Database migrations
│   └── pyproject.toml
├── frontend/
│   └── lib/
│       ├── core/                 # Config, theme, router
│       ├── models/               # Data models
│       ├── services/             # API client, providers
│       ├── screens/              # Top-level pages
│       └── widgets/              # Reusable components
├── infra/docker/
│   ├── docker-compose.yml
│   └── .env.example
└── Makefile
```

## Key Implementation Notes

1. **uv package manager:** Always use `uv run` instead of `pip` for Python packages
2. **Async required:** Backend must use async/await for all I/O (database, HTTP)
3. **Error isolation:** Sync failures for one repo/connector shouldn't block others
4. **Rate limiting:** `RateLimiter` in `connectors/rate_limiter.py` prevents API throttling
5. **Detail syncing:** PRs synced fast first, details (reviews/comments) filled gradually
6. **No premature optimization:** Keep solutions simple, avoid over-engineering
7. **Type safety:** Python type hints + Dart strict types required
