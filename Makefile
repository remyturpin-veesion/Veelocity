# Makefile
.PHONY: dev dev-local dev-frontend dev-db down logs shell-backend test migrate lint format db

# Development avec Docker (PostgreSQL + backend)
dev:
	docker-compose -f infra/docker/docker-compose.yml up -d

# Development local backend (hot reload) - requires uv, and DB + migrations for make db workflow
# Backend logs (including OAuth errors) appear in this terminal, not in make logs
dev-local:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

# PostgreSQL + run migrations (use with make dev-local: make dev-db && make dev-local)
dev-db: db
	$(MAKE) migrate

# Frontend React (Vite) - requires VITE_API_BASE_URL in frontend-react/.env (default http://localhost:8000)
dev-frontend:
	cd frontend-react && pnpm run dev

# Démarrer juste PostgreSQL (no migrations; use dev-db for local backend)
db:
	docker-compose -f infra/docker/docker-compose.yml up -d postgres

down:
	docker-compose -f infra/docker/docker-compose.yml down

# Logs from Docker containers only (postgres + backend if you use make dev, not make dev-local)
logs:
	docker-compose -f infra/docker/docker-compose.yml logs -f

shell-backend:
	docker-compose -f infra/docker/docker-compose.yml exec backend /bin/bash

# Backend
test:
	cd backend && uv run pytest -v

migrate:
	cd backend && uv run alembic upgrade head

migrate-create:
	cd backend && uv run alembic revision --autogenerate -m "$(name)"

# Linting
lint:
	cd backend && uv run ruff check app/

format:
	cd backend && uv run black app/
