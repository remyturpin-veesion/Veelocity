# Makefile
.PHONY: dev down logs shell-backend test migrate

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
	cd backend && pytest -v

migrate:
	cd backend && alembic upgrade head

migrate-create:
	cd backend && alembic revision --autogenerate -m "$(name)"

# Linting
lint:
	cd backend && ruff check app/

format:
	cd backend && black app/
