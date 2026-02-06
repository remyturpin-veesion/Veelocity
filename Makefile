# Makefile — Veelocity
.PHONY: dev dev-local dev-frontend dev-db db down logs shell-backend test migrate migrate-create lint format prod prod-down prod-logs prod-build

# =============================================================================
# Development
# =============================================================================

# Start PostgreSQL + backend in Docker
dev:
	docker compose -f infra/docker/docker-compose.yml up -d

# Start backend locally with hot reload (requires uv + running DB)
dev-local:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

# Start PostgreSQL + run migrations (use with dev-local)
dev-db: db
	$(MAKE) migrate

# Start frontend dev server (Vite, http://localhost:5173)
dev-frontend:
	cd frontend-react && pnpm run dev

# Start PostgreSQL only (no migrations)
db:
	docker compose -f infra/docker/docker-compose.yml up -d postgres

# Stop all dev containers
down:
	docker compose -f infra/docker/docker-compose.yml down

# View dev container logs
logs:
	docker compose -f infra/docker/docker-compose.yml logs -f

# Shell into backend container
shell-backend:
	docker compose -f infra/docker/docker-compose.yml exec backend /bin/bash

# =============================================================================
# Production
# =============================================================================

# Start all production services
prod:
	docker compose -f infra/docker/docker-compose.prod.yml up -d

# Build and start production services
prod-build:
	docker compose -f infra/docker/docker-compose.prod.yml up -d --build

# Stop all production services
prod-down:
	docker compose -f infra/docker/docker-compose.prod.yml down

# View production logs
prod-logs:
	docker compose -f infra/docker/docker-compose.prod.yml logs -f

# =============================================================================
# Backend
# =============================================================================

# Run backend tests
test:
	cd backend && uv run pytest -v

# Apply database migrations
migrate:
	cd backend && uv run alembic upgrade head

# Create a new migration: make migrate-create name="description"
migrate-create:
	cd backend && uv run alembic revision --autogenerate -m "$(name)"

# Run Ruff linter
lint:
	cd backend && uv run ruff check app/

# Run Black formatter
format:
	cd backend && uv run black app/
