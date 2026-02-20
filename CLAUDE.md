# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veelocity is a single-user developer analytics platform measuring DORA metrics and development performance. It syncs data from GitHub, GitHub Actions, Linear, Cursor, and Greptile to provide insights on deployment frequency, lead time, PR review time, cycle time, and throughput.

**Key characteristics:**
- User accounts with email/password; JWT auth protects all API routes except `/api/v1/auth/*` and `/api/v1/health`
- GitHub & Linear credentials stored encrypted in the database (Settings UI); only encryption key in `.env`
- Python 3.11+ backend with FastAPI + PostgreSQL
- React frontend (Vite, TypeScript, web) in `frontend-react/`
- Managed with `uv` (backend), pnpm (frontend)

## Development Setup

### Backend (Python/FastAPI)

```bash
# Start PostgreSQL + backend via Docker
make dev

# Start backend locally with hot reload (requires backend/.env)
make dev-local  # or: cd backend && uv run uvicorn app.main:app --reload

# Start only PostgreSQL (for local backend dev)
make db

# PostgreSQL + migrations in one step
make dev-db  # = make db + make migrate

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

# Docker debugging
make shell-backend  # Shell into backend container
```

### Frontend (React)

```bash
make dev-frontend        # Run Vite dev server (default http://localhost:5173)
# or: cd frontend-react && pnpm run dev

cd frontend-react
pnpm install             # Install dependencies
pnpm run build           # Production build
pnpm run preview         # Preview production build
```

Set `VITE_API_BASE_URL` in `frontend-react/.env` (default `http://localhost:8000`) to point at the backend.

### Docker

```bash
make down   # Stop all containers
make logs   # View Docker container logs (not make dev-local output)
```

### Environment Variables

Three `.env` file locations depending on dev mode:
- `backend/.env` — for `make dev-local` (local backend)
- `infra/docker/.env` — for `make dev` (Docker); see `infra/docker/.env.example`
- `frontend-react/.env` — `VITE_API_BASE_URL` for Vite

## Architecture

### User & Authentication
- **User model:** `app/models/user.py` — email (unique), password_hash, created_at.
- **Auth endpoints:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`. GitHub OAuth remains at `/api/v1/auth/github` for Settings.
- **Security:** Passwords hashed with bcrypt (passlib). JWT access tokens (HS256) via `JWT_SECRET_KEY`; set in `.env` (required in production).
- **Protection:** All API routes except auth and health require `Authorization: Bearer <token>`. Dependency `get_current_user` in `app/core/deps.py`.

### Credentials Management
GitHub and Linear API keys are stored encrypted in the database. Configure them in the app via **Settings** (gear icon). The backend does not read these from `.env`.

- **Encryption:** Set `VEELOCITY_ENCRYPTION_KEY` in `.env` (Fernet key, base64). Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Without it, the Settings UI cannot save API keys.
- **JWT:** Set `JWT_SECRET_KEY` in `.env` for user login (e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Default in code is a placeholder; use a strong secret in production.
- **GitHub:** API key and repos (comma-separated `owner/repo1,owner/repo2`) — set in Settings.
- **Linear:** API key (Linear → Settings → API) and optional workspace name — set in Settings.
- **Sync:** `DEPLOYMENT_PATTERNS` (comma-separated: "deploy,release,publish") remains in `.env`.
- **GitHub OAuth (optional):** Requires `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `OAUTH_BACKEND_BASE_URL`, `OAUTH_FRONTEND_REDIRECT_URL`. Endpoints at `/api/v1/auth/github`.
- **Sentry (optional):** Error reporting. Backend: `SENTRY_DSN` in backend env; frontend: `VITE_SENTRY_DSN` in frontend env. For self-hosted Sentry the DSN is from Project → Client Keys (DSN). Omit to disable.

### Sync Architecture

**Staggered sync schedule** (prevents simultaneous API calls):
- GitHub + Actions: every 5 min (runs immediately on startup)
- Linear: every 5 min (first run at +2 min)
- Cursor: every 5 min (first run at +4 min)
- Greptile: every 5 min (first run at +6 min)
- Fill details: every 10 min (first run at +8 min)

**Smart sync behavior:**
- First run: Fast sync (`fetch_details=False`, PRs only) for repos without data
- Subsequent runs: Incremental sync (`sync_recent`, only items updated since last sync)
- Background detail filling: Gradually fills reviews/comments/commits in batches of 100 PRs

**Error isolation:**
- Each repo sync is isolated — one failure doesn't block others
- Per-connector error handling — GitHub failure doesn't block Linear
- Commits after each repo to preserve progress

**Key implementation:**
- `app/services/scheduler.py` — orchestrates sync jobs
- `app/services/sync.py` — SyncService handles upsert logic
- `app/connectors/base.py` — BaseConnector ABC defines interface
- All sync operations are async

### Data Source Integrations

**BaseConnector pattern** (GitHub, GitHub Actions, Linear):

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

**Connectors:**
- `GitHubConnector` — repos, PRs, reviews, comments, commits
- `GitHubActionsConnector` — workflows, runs (for deployments)
- `LinearConnector` — teams, issues (for cycle time)

**Connector factory:** `app/connectors/factory.py` creates connector instances

**Non-connector integrations** (Cursor, Greptile) — these do NOT use the BaseConnector pattern. They have their own sync services (`app/services/sync_cursor.py`, `app/services/sync_greptile.py`) and are synced directly by the scheduler. Models: `CursorTeamMember`, `CursorSpendSnapshot`, `CursorDailyUsage`, `CursorDau`, `GreptileRepository`.

### Rate Limiting

`RateLimiter` in `connectors/rate_limiter.py` provides adaptive throttling for GitHub API:
- Reads `x-ratelimit-remaining` headers and adjusts delay dynamically
- Per-sync limit (default 500 calls) and per-hour limit (default 4000 calls)
- Auto-pauses when remaining < 50 and waits for rate limit reset
- Configurable via `RATE_LIMIT_MAX_PER_SYNC`, `RATE_LIMIT_MAX_PER_HOUR`, `RATE_LIMIT_DELAY_MS`

### Deployment Detection

Deployments detected from GitHub Actions workflows matching configurable patterns.

**Configuration:** `DEPLOYMENT_PATTERNS` env var (default: "deploy,release,publish")

**Logic:** `app/core/config.py:is_deployment_workflow()` — checks if workflow name/path contains patterns

### Pagination

Standardized across all list endpoints:
- `PaginationParams` dependency via `Depends(get_pagination_params)`
- Default limit: 20 items (`PAGINATION_DEFAULT_LIMIT`), max: 100 (`PAGINATION_MAX_LIMIT`)
- `PaginatedResponse` generic type for consistent API responses
- Schema in `app/schemas/pagination.py`

### Frontend Architecture

**Path aliases:** `@/` maps to `./src/` (configured in `vite.config.ts` and `tsconfig.app.json`)

**Zustand stores:**
- `stores/filters.ts` — date range (preset 7/30/90 days or custom), `repoIds`, `developerLogins`, `teamIds`, `timeInStateStageIds` (empty = all); persisted to localStorage
- `stores/theme.ts` — light/dark mode

**Server state:** TanStack Query (React Query) for API data; filter store values used in query keys.

**HTTP client:** Native `fetch` in `api/client.ts` (not axios). `apiPost` accepts optional `timeoutMs`.

**Navigation:** React Router v6 with `createBrowserRouter`; nested routes under `ShellLayout`. Top-level tabs: Dashboard, Team, GitHub, Linear, Data coverage.

## Code Conventions

### Python (Backend)

- **Async everywhere:** All I/O operations use `async/await`
- **Type hints required:** Use Python 3.11+ type syntax (`list[str]`, `dict[str, Any]`, `int | None`)
- **Docstrings:** Google style for public APIs
- **Formatting:** `black` (line length 88)
- **Linting:** `ruff`
- **Testing:** `pytest` + `pytest-asyncio` (asyncio_mode = "auto")
- **Service pattern:** Services take `AsyncSession` in `__init__`, are instantiated per-request

**Test setup:**
- `backend/tests/conftest.py` — shared fixtures (async client)
- Use `respx` for mocking HTTP calls

### TypeScript/React (Frontend)

- **State:** Zustand (filters, theme), TanStack Query (server state)
- **HTTP:** `fetch` in `frontend-react/src/api/client.ts`
- **Charts:** Recharts
- **Imports:** Use `@/` path alias (e.g., `import { api } from '@/api/client'`)
- **Formatting:** ESLint; optional `pnpm run lint` in frontend-react

### Git Commits

Format: `type(scope): message`

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`

**Examples:**
- `feat(metrics): add PR review time calculation`
- `fix(sync): handle missing PR details gracefully`
- `refactor(connector): extract common rate limiting logic`

## Database

- **PostgreSQL 15** (port 5433 in dev to avoid conflicts with local PostgreSQL)
- **ORM:** SQLAlchemy 2.0 async (models use `Mapped` type hints)
- **Session:** `async_session_maker` with `expire_on_commit=False` to prevent lazy loading issues
- **Migrations:** Alembic
- **Schema:** All models in `backend/app/models/`
  - `github.py` — Repository, PullRequest, PRReview, PRComment, Commit
  - `linear.py` — LinearTeam, LinearIssue
  - `cursor.py` — CursorTeamMember, CursorSpendSnapshot, CursorDailyUsage, CursorDau
  - `greptile.py` — GreptileRepository
  - `sync.py` — SyncState

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
- `backend/app/services/metrics/dora.py` — DORA metrics
- `backend/app/services/metrics/development.py` — dev metrics
- `backend/app/services/metrics/developers.py` — per-developer breakdowns
- `backend/app/services/metrics/insights/` — recommendations, correlations, anomaly detection, benchmarks

## Key Implementation Notes

1. **uv package manager:** Always use `uv run` instead of `pip` for Python packages
2. **Async required:** Backend must use async/await for all I/O (database, HTTP)
3. **Error isolation:** Sync failures for one repo/connector shouldn't block others
4. **Rate limiting:** Adaptive `RateLimiter` in `connectors/rate_limiter.py` prevents API throttling
5. **Detail syncing:** PRs synced fast first, details (reviews/comments) filled gradually in batches
6. **No premature optimization:** Keep solutions simple, avoid over-engineering
7. **Type safety:** Python type hints + TypeScript in frontend-react
8. **Logging:** SQLAlchemy engine/pool and httpx/httpcore logs suppressed to WARNING level; app logs at INFO
9. **Cursor & Greptile:** Use separate sync services, not the BaseConnector pattern

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->