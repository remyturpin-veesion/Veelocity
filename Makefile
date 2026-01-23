# Makefile
.PHONY: dev down logs shell-backend test migrate lint format

# Development
dev:
	docker-compose -f infra/docker/docker-compose.yml up -d

down:
	docker-compose -f infra/docker/docker-compose.yml down

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
