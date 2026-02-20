# Veelocity — Production Deployment Guide

This guide covers deploying Veelocity in production using Docker Compose. **All app configuration** (GitHub, Linear, Cursor, Greptile) is done in the app via **Settings** (gear icon) after deploy.

**veelocity.tooling.veesion.io:** [deployment-veelocity-tooling-veesion-io.md](deployment-veelocity-tooling-veesion-io.md)

## Architecture Overview

Veelocity consists of three services:

```
┌──────────┐     ┌──────────┐     ┌────────────┐
│ Frontend │────▶│ Backend  │────▶│ PostgreSQL │
│ (nginx)  │     │ (FastAPI)│     │    15      │
│ :80      │     │ :8000    │     │ :5432      │
└──────────┘     └──────────┘     └────────────┘
```

- **Frontend**: Static React SPA served by nginx
- **Backend**: FastAPI application (Python 3.11+), runs migrations on startup, syncs data on a schedule
- **PostgreSQL**: Persistent data store

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A server with at least 1 GB RAM and 10 GB disk
- (Optional) A reverse proxy / load balancer for TLS termination (e.g., Traefik, Caddy, or cloud LB)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/veesion-io/veelocity.git
cd veelocity

# 2. Configure environment
cp infra/docker/.env.example infra/docker/.env
```

Edit `infra/docker/.env` with production values — see [Environment Variables](#environment-variables) below.

```bash
# 3. Start all services
docker compose -f infra/docker/docker-compose.prod.yml up -d

# 4. Verify
docker compose -f infra/docker/docker-compose.prod.yml ps
curl http://localhost:8000/api/v1/health   # → {"status":"healthy"}
curl http://localhost/health               # → ok (frontend nginx)
```

The frontend is available at **http://localhost** (port 80) and the API at **http://localhost:8000**.

## Environment Variables

All variables are set in `infra/docker/.env`. The table below documents every variable.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | `a-strong-random-password` |
| `VEELOCITY_ENCRYPTION_KEY` | Fernet key for encrypting API credentials stored in DB | See generation command below |
| `JWT_SECRET_KEY` | Secret for signing JWT access tokens (user login). **Must** be a long random value in production | See generation command below |

Generate the encryption key:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Or without Python installed:

```bash
docker run --rm python:3.11-slim python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Generate the JWT secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `veelocity` | PostgreSQL username |
| `POSTGRES_PASSWORD` | — | PostgreSQL password (**required**) |
| `POSTGRES_DB` | `veelocity` | Database name |
| `POSTGRES_PORT` | `5432` | Exposed PostgreSQL port (use `5433` in dev to avoid conflicts) |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Set to `false` in production |
| `DEPLOYMENT_PATTERNS` | `deploy,release,publish` | Comma-separated patterns to identify deployment workflows |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend URL baked into the frontend at build time |
| `CORS_ALLOWED_ORIGINS` | — | Production: comma-separated origins (e.g. `https://your-domain.com`); leave empty to allow all |

### GitHub OAuth (optional)

If you want "Connect with GitHub" in Settings, set these (see [GitHub OAuth setup](guides/github-oauth-setup.md)):

| Variable | Description |
|----------|-------------|
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App client secret |
| `OAUTH_BACKEND_BASE_URL` | Public URL of the backend (e.g. `https://api.veelocity.example.com`) |
| `OAUTH_FRONTEND_REDIRECT_URL` | URL to redirect after OAuth (e.g. `https://veelocity.example.com`) |

### Rate limiting (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_MAX_PER_SYNC` | `500` | Max GitHub API calls per sync |
| `RATE_LIMIT_MAX_PER_HOUR` | `4000` | Max GitHub API calls per hour |
| `RATE_LIMIT_DELAY_MS` | `100` | Delay between API calls (ms) |

## Health Checks

Both the backend and frontend have built-in health checks:

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Backend | `GET /api/v1/health` | `{"status": "healthy"}` |
| Frontend | `GET /health` | `ok` (200) |

Docker Compose is configured to use these health checks. The backend waits for PostgreSQL to be healthy before starting, and the frontend waits for the backend.

## Data Sync

Veelocity syncs data automatically on a staggered schedule to avoid simultaneous API calls:

| Source | Interval | First Run |
|--------|----------|-----------|
| GitHub + Actions | 5 min | Immediately on startup |
| Linear | 5 min | +2 min after startup |
| Cursor | 5 min | +4 min after startup |
| Greptile | 5 min | +6 min after startup |
| Fill PR details | 10 min | +8 min after startup |

**Important**: GitHub and Linear API keys are configured in the app's **Settings UI** (gear icon), not in environment variables. They are stored encrypted in the database.

## Database

### Migrations

Migrations run automatically on container startup via `docker-entrypoint.sh`. No manual intervention needed.

To run migrations manually:

```bash
docker compose -f infra/docker/docker-compose.prod.yml exec backend uv run alembic upgrade head
```

### Backups

PostgreSQL data is stored in a Docker volume (`postgres_data`). Back up regularly:

```bash
# Dump database
docker compose -f infra/docker/docker-compose.prod.yml exec postgres \
  pg_dump -U veelocity veelocity > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker compose -f infra/docker/docker-compose.prod.yml exec -T postgres \
  psql -U veelocity veelocity < backup_20260206_120000.sql
```

## Reverse Proxy / TLS

In production, place a reverse proxy in front of Veelocity for TLS termination. Example with **Caddy** (auto-HTTPS):

```
# Caddyfile
veelocity.example.com {
    # Frontend
    reverse_proxy localhost:80

    # API
    handle /api/* {
        reverse_proxy localhost:8000
    }
}
```

When using a reverse proxy, set `VITE_API_BASE_URL` to your public URL and `CORS_ALLOWED_ORIGINS` to that origin.

## Updating

```bash
cd veelocity

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f infra/docker/docker-compose.prod.yml up -d --build

# Check logs
docker compose -f infra/docker/docker-compose.prod.yml logs -f
```

Migrations are applied automatically on backend container startup.

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose -f infra/docker/docker-compose.prod.yml logs backend

# Shell into the container
docker compose -f infra/docker/docker-compose.prod.yml exec backend /bin/bash
```

### Database connection issues

- Ensure PostgreSQL is healthy: `docker compose -f infra/docker/docker-compose.prod.yml ps`
- Verify `POSTGRES_PASSWORD` matches between the `postgres` and `backend` services
- The backend waits for PostgreSQL health check before starting

### Sync not working

- Check that API keys are configured in **Settings** (gear icon in the UI)
- Verify `VEELOCITY_ENCRYPTION_KEY` is set — without it, the app cannot save or read API keys
- Check backend logs for sync errors: `docker compose -f infra/docker/docker-compose.prod.yml logs backend | grep -i sync`

### Frontend shows blank page or API errors

- Verify `VITE_API_BASE_URL` is set to the correct backend URL
- This value is baked in at **build time** — if you change it, rebuild the frontend: `docker compose -f infra/docker/docker-compose.prod.yml up -d --build frontend`

## API Documentation

Interactive API docs are available at:
- **Swagger UI**: `http://<backend-host>:8000/docs`
- **ReDoc**: `http://<backend-host>:8000/redoc`
