#!/bin/sh
set -e
# Run migrations so the schema exists before the app starts (fixes "relation does not exist" on first run)
echo "Running database migrations..."
uv run alembic upgrade head
echo "Starting application..."
exec "$@"
