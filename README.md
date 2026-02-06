# Veelocity

Developer Analytics Platform — Measures and visualizes DORA metrics and development performance by syncing data from GitHub, GitHub Actions, Linear, Cursor, and Greptile.

## Features

### DORA Metrics
- **Deployment Frequency** — Count of deployments per period (from GitHub Actions)
- **Lead Time for Changes** — Time from first commit to deployment

### Development Metrics
- **PR Review Time** — Time from PR opened to first review
- **PR Merge Time** — Time from PR opened to merged
- **Cycle Time** — Time from Linear issue creation to PR merged
- **Throughput** — Merged PRs per period

### Integrations

| Source | Data |
|--------|------|
| GitHub | Repositories, Pull Requests, Reviews, Comments, Commits |
| GitHub Actions | Workflows, Runs (deployment detection) |
| Linear | Teams, Issues (cycle time tracking) |
| Cursor | Team usage analytics (requires Enterprise) |
| Greptile | Repository indexing status |

### Other Capabilities
- Automated alerts (webhook + email notifications)
- Per-developer performance breakdowns
- Anomaly detection and DORA benchmarking
- Data export (CSV/JSON)
- Light/dark mode

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ / FastAPI |
| Frontend | React 19 (Vite, TypeScript) |
| Database | PostgreSQL 15 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Backend packages | Managed with [uv](https://docs.astral.sh/uv/) |
| Frontend packages | Managed with [pnpm](https://pnpm.io/) |

## Quick Start (Development)

### Prerequisites

- Docker & Docker Compose v2
- [uv](https://docs.astral.sh/uv/) (for local backend dev)
- Node.js 18+ and pnpm (for frontend dev)

### 1. Clone and configure

```bash
git clone https://github.com/veesion-io/veelocity.git
cd veelocity

# Backend environment (Docker mode)
cp infra/docker/.env.example infra/docker/.env
# Edit infra/docker/.env — set VEELOCITY_ENCRYPTION_KEY (see .env.example for instructions)

# Backend environment (local mode)
cp backend/.env.example backend/.env
# Edit backend/.env — set VEELOCITY_ENCRYPTION_KEY

# Frontend environment
cp frontend-react/.env.example frontend-react/.env
# Default VITE_API_BASE_URL=http://localhost:8000 is usually fine
```

### 2. Install frontend dependencies

```bash
cd frontend-react && pnpm install && cd ..
```

### 3. Start services

**Option A — Docker (PostgreSQL + backend):**

```bash
make dev            # Starts PostgreSQL + backend in Docker
make dev-frontend   # Starts frontend dev server (separate terminal)
```

**Option B — Local backend with hot reload:**

```bash
make dev-db         # Starts PostgreSQL in Docker + runs migrations
make dev-local      # Starts backend locally with hot reload (separate terminal)
make dev-frontend   # Starts frontend dev server (separate terminal)
```

The frontend is served at http://localhost:5173 and calls the API at http://localhost:8000.

### 4. Configure data sources

Open http://localhost:5173 and click the **Settings** (gear icon) to configure:
- **GitHub**: API token + repositories (comma-separated `owner/repo`)
- **Linear**: API key (from Linear → Settings → API)

Data sync starts automatically after credentials are saved.

## Production Deployment

See [docs/deployment.md](docs/deployment.md) for full production deployment instructions, including:
- Docker Compose production setup
- Environment variable reference
- Health checks and monitoring
- Reverse proxy configuration

**Quick production start:**

```bash
cp infra/docker/.env.example infra/docker/.env
# Edit .env with production values (see docs/deployment.md)

docker compose -f infra/docker/docker-compose.prod.yml up -d
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start PostgreSQL + backend in Docker |
| `make dev-local` | Start backend locally with hot reload |
| `make dev-frontend` | Start frontend dev server (Vite) |
| `make dev-db` | Start PostgreSQL + run migrations |
| `make db` | Start PostgreSQL only |
| `make down` | Stop all Docker containers |
| `make logs` | View Docker container logs |
| `make test` | Run backend tests |
| `make migrate` | Apply database migrations |
| `make migrate-create name="..."` | Create a new migration |
| `make lint` | Run Ruff linter on backend |
| `make format` | Run Black formatter on backend |
| `make shell-backend` | Shell into backend container |

## Project Structure

```
veelocity/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/v1/          # REST API endpoints
│   │   ├── connectors/      # GitHub, GitHub Actions, Linear connectors
│   │   ├── core/            # Config, database, encryption
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic, sync, metrics
│   ├── alembic/             # Database migrations
│   ├── tests/               # Backend tests
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend-react/           # React SPA
│   ├── src/
│   │   ├── api/             # HTTP client
│   │   ├── components/      # Reusable UI components
│   │   ├── screens/         # Page components
│   │   └── stores/          # Zustand state stores
│   ├── Dockerfile
│   └── package.json
├── infra/docker/             # Docker Compose files
│   ├── docker-compose.yml    # Development
│   └── docker-compose.prod.yml  # Production
├── docs/                     # Documentation
│   ├── deployment.md         # Production deployment guide
│   └── guides/               # Feature-specific guides
└── Makefile
```

## API

The backend exposes a REST API at `/api/v1/`. Interactive API documentation is available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health check**: `GET /api/v1/health` → `{"status": "healthy"}`

## License

Proprietary — Veesion 2026
