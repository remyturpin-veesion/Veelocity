# Veelocity

A **single-user developer analytics platform** that measures DORA metrics and development performance. Veelocity syncs data from GitHub, GitHub Actions, Linear, Cursor, Greptile, and Sentry to provide insights on deployment frequency, lead time, PR review time, cycle time, throughput, and more.

## Features

### Authentication

- **Email/password** sign-up and login with JWT-protected API
- All routes except `/api/v1/auth/*` and `/api/v1/health` require `Authorization: Bearer <token>`
- Optional **GitHub OAuth** for linking accounts (see [docs/guides/github-oauth-setup.md](docs/guides/github-oauth-setup.md))

### DORA Metrics

- **Deployment frequency** — Deployments per period (from GitHub Actions workflow patterns)
- **Lead time for changes** — Time from first commit to deployment

### Development Metrics

- **PR review time** — Time from PR opened to first review
- **PR merge time** — Time from PR opened to merged
- **Cycle time** — Time from Linear issue creation to PR merged (GitHub–Linear linking)
- **Throughput** — Merged PRs per period
- **Linear** — Issues completed, backlog, time-in-state

### Integrations

| Source           | Data |
|------------------|------|
| **GitHub**       | Repositories, pull requests, reviews, comments, commits |
| **GitHub Actions**| Workflows and runs (deployment detection via configurable patterns) |
| **Linear**       | Teams, issues (cycle time; optional developer–Linear links) |
| **Cursor**       | Team usage analytics (Enterprise; see [docs/guides/cursor-connection.md](docs/guides/cursor-connection.md)) |
| **Greptile**     | Repository indexing status, recommendations |
| **Sentry**       | Projects, issues, error trends (optional; DSN in env) |

### Other Capabilities

- Per-developer performance breakdowns and **developer–Linear** linking
- **Developer teams** for grouping and filtering
- DORA **benchmarks** and **anomaly detection**
- **Insights**: recommendations (Greptile), correlations
- **Data export** (CSV/JSON)
- **Light/dark** theme
- **Pagination** on list endpoints (default 20, max 100)

Credentials for GitHub, Linear, Cursor, and Greptile are configured in the app **Settings** (gear icon) and stored **encrypted** in the database; only the encryption key lives in `.env`.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Backend  | Python 3.11+, FastAPI |
| Frontend | React (Vite, TypeScript) |
| Database | PostgreSQL 15 |
| ORM      | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Backend packages | [uv](https://docs.astral.sh/uv/) |
| Frontend packages | [pnpm](https://pnpm.io/) |

## Quick Start (Development)

### Prerequisites

- Docker & Docker Compose v2
- [uv](https://docs.astral.sh/uv/) (for local backend)
- Node.js 18+ and pnpm (for frontend)

### 1. Clone and configure

```bash
git clone https://github.com/veesion-io/veelocity.git
cd veelocity

# Backend (Docker mode)
cp infra/docker/.env.example infra/docker/.env
# Edit infra/docker/.env: set VEELOCITY_ENCRYPTION_KEY and JWT_SECRET_KEY (see below)

# Backend (local mode)
cp backend/.env.example backend/.env
# Edit backend/.env: set VEELOCITY_ENCRYPTION_KEY and JWT_SECRET_KEY

# Frontend
cp frontend-react/.env.example frontend-react/.env
# VITE_API_BASE_URL=http://localhost:8000 is the default
```

**Required env (backend):**

- **VEELOCITY_ENCRYPTION_KEY** — Fernet key for encrypting API keys in the DB.  
  Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- **JWT_SECRET_KEY** — Secret for JWT (e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Use a strong value in production.

### 2. Install frontend dependencies

```bash
cd frontend-react && pnpm install && cd ..
```

### 3. Start services

**Option A — Docker (PostgreSQL + backend):**

```bash
make dev
make dev-frontend   # in another terminal
```

**Option B — Local backend with hot reload:**

```bash
make dev-db        # PostgreSQL + migrations
make dev-local     # backend with hot reload
make dev-frontend  # in another terminal
```

- Frontend: **http://localhost:5173**
- API: **http://localhost:8000**

### 4. Create a user and configure sources

1. Open http://localhost:5173 and **register** (or use **Login** if you already have an account).
2. Open **Settings** (gear icon) to configure:
   - **GitHub**: API token + repositories (comma-separated `owner/repo`)
   - **Linear**: API key (Linear → Settings → API), optional workspace name

Sync runs on a schedule after credentials are saved (GitHub/Actions every 5 min, Linear offset, then Cursor, Greptile, and detail-fill).

## Production Deployment

See [docs/deployment.md](docs/deployment.md) for:

- Docker Compose production setup
- Environment variable reference
- Health checks and reverse proxy

**Quick production start:**

```bash
cp infra/docker/.env.example infra/docker/.env
# Edit .env with production values (POSTGRES_PASSWORD, VEELOCITY_ENCRYPTION_KEY, JWT_SECRET_KEY, optional CORS/VITE_API_BASE_URL)

docker compose -f infra/docker/docker-compose.prod.yml up -d
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start PostgreSQL + backend in Docker |
| `make dev-local` | Start backend locally with hot reload |
| `make dev-frontend` | Start frontend dev server (Vite) |
| `make dev-db` | Start PostgreSQL and run migrations |
| `make db` | Start PostgreSQL only |
| `make down` | Stop all Docker containers |
| `make logs` | View Docker container logs |
| `make test` | Run backend tests |
| `make migrate` | Apply database migrations |
| `make migrate-create name="..."` | Create a new migration |
| `make lint` | Run Ruff on backend |
| `make format` | Run Black on backend |
| `make shell-backend` | Shell into backend container |
| `make prod` | Start production stack |
| `make prod-build` | Build and start production stack |
| `make prod-down` | Stop production stack |
| `make prod-logs` | View production logs |

## Project Structure

```
veelocity/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST API (auth, developers, metrics, etc.)
│   │   ├── connectors/      # GitHub, GitHub Actions, Linear (BaseConnector)
│   │   ├── core/            # Config, database, encryption, deps
│   │   ├── models/          # SQLAlchemy models (User, Repository, PullRequest,
│   │   │                    # LinearIssue, Cursor*, Greptile, Sentry, DeveloperTeam,
│   │   │                    # DeveloperLinearLink, AppSettings, SyncState, etc.)
│   │   ├── schemas/         # Pydantic schemas and pagination
│   │   └── services/        # Sync, scheduler, metrics (DORA, development, insights)
│   ├── alembic/             # Database migrations
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend-react/
│   ├── src/
│   │   ├── api/             # HTTP client (fetch), endpoints
│   │   ├── components/     # AppShell, ShellLayout, AuthGuard, etc.
│   │   ├── screens/        # Dashboard, DORA, GitHub, Linear, Cursor, Greptile,
│   │   │                    # Sentry, Team, Data coverage, metrics, insights
│   │   └── stores/         # Zustand (filters, theme); TanStack Query for API
│   ├── Dockerfile
│   └── package.json
├── infra/docker/
│   ├── docker-compose.yml      # Development
│   └── docker-compose.prod.yml # Production
├── docs/
│   ├── deployment.md           # Production guide + example runbook
│   ├── SRE_DEPLOYMENT_HANDOFF.md
│   ├── SECOPS_CHECKLIST.md
│   ├── SECURITY_AUDIT_SECRETS.md
│   ├── greptile-indexing-flow.md
│   └── guides/
│       ├── github-oauth-setup.md
│       └── cursor-connection.md
└── Makefile
```

## API

REST API base: **`/api/v1/`**

- **Swagger UI**: http://localhost:8000/docs  
- **ReDoc**: http://localhost:8000/redoc  
- **Health**: `GET /api/v1/health` → `{"status": "healthy"}`

All endpoints except auth and health require the `Authorization: Bearer <token>` header.

## Documentation

- [CLAUDE.md](CLAUDE.md) — Development and architecture notes for contributors
- [docs/deployment.md](docs/deployment.md) — Production deployment
- [docs/guides/github-oauth-setup.md](docs/guides/github-oauth-setup.md) — GitHub OAuth
- [docs/guides/cursor-connection.md](docs/guides/cursor-connection.md) — Cursor integration
- [docs/SECOPS_CHECKLIST.md](docs/SECOPS_CHECKLIST.md) — Security checklist

## License

Proprietary — Veesion 2026
