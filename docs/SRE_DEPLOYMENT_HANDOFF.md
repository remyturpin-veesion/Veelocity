# SRE Deployment Handoff — Veelocity

This document prepares everything needed to request a new deployment from the SRE team, following the process described in:

**[Asking for a new deployment](https://www.notion.so/Asking-for-a-new-deployment-30c16e5d54c08039a760d3392419dece)** (Notion)

Use this handoff to fill in the Notion form and attach or link the referenced docs.

---

## 1. Application summary

| Field | Value |
|-------|--------|
| **Application name** | Veelocity |
| **Description** | Single-user developer analytics platform: DORA metrics (deployment frequency, lead time), PR review/merge time, cycle time, throughput. Syncs from GitHub, GitHub Actions, Linear, Cursor, Greptile, Sentry. |
| **Repository** | (your repo URL, e.g. `https://github.com/veesion-io/veelocity`) |
| **Stack** | Docker Compose: PostgreSQL 15, FastAPI (Python 3.11), React (Vite) frontend served by nginx |

---

## 2. Architecture

```
                    ┌─────────────────────────────────────────┐
                    │  Reverse proxy (TLS, e.g. Caddy/Traefik)│
                    │  /api/* → backend   / → frontend         │
                    └─────────────────────┬───────────────────┘
                                          │
    ┌─────────────┐      ┌────────────────▼────────────────┐      ┌──────────────┐
    │  Frontend   │─────▶│  Backend (FastAPI)               │─────▶│  PostgreSQL  │
    │  nginx:80   │      │  :8000 — API, migrations, sync   │      │  15 :5432    │
    └─────────────┘      └─────────────────────────────────┘      └──────────────┘
```

- **Frontend**: Static SPA (React), built with `VITE_API_BASE_URL` at build time.
- **Backend**: Runs migrations on startup; background sync (GitHub, Linear, Cursor, Greptile) on a schedule.
- **PostgreSQL**: Single instance; data in Docker volume `postgres_data`.
- **Secrets**: GitHub/Linear/Cursor/Greptile/Sentry API keys are configured in the app **Settings** UI and stored **encrypted** in the DB; only `VEELOCITY_ENCRYPTION_KEY` and `JWT_SECRET_KEY` are required in env.

---

## 3. Deployment method

- **Compose file**: `infra/docker/docker-compose.prod.yml`
- **Usage**: From repo root, with env file next to the compose file:
  ```bash
  docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d --build
  ```
- **Requirements**: Docker Engine 24+, Docker Compose v2. No Kubernetes; single-host Compose deployment.

---

## 4. Environment variables (for SRE)

Create `infra/docker/.env` from `infra/docker/.env.example`. Compose **requires** (fails at startup if missing):

| Variable | Description | How to generate |
|----------|-------------|-----------------|
| `POSTGRES_PASSWORD` | PostgreSQL password | Strong random value |
| `VEELOCITY_ENCRYPTION_KEY` | Fernet key for encrypting API keys in DB | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `JWT_SECRET_KEY` | JWT signing secret for user login | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |

**Production-specific (set for target URL):**

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Public backend URL (baked into frontend at **build** time) | `https://veelocity.example.com` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origin(s) | `https://veelocity.example.com` |
| `DEBUG` | Must be `false` in production | `false` |

**Optional:**

- **GitHub OAuth**: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `OAUTH_BACKEND_BASE_URL`, `OAUTH_FRONTEND_REDIRECT_URL` — see [docs/guides/github-oauth-setup.md](guides/github-oauth-setup.md).
- **Rate limiting**: `RATE_LIMIT_MAX_PER_SYNC`, `RATE_LIMIT_MAX_PER_HOUR`, `RATE_LIMIT_DELAY_MS` (defaults in [deployment.md](deployment.md)).

All variables are documented in [docs/deployment.md](deployment.md#environment-variables).

---

## 5. Health checks and verification

| Service | Check | Expected |
|---------|--------|----------|
| Backend | `GET /api/v1/health` | `{"status":"healthy"}` (no auth) |
| Frontend | `GET /health` | `ok` (200) |

Compose healthchecks are defined in `docker-compose.prod.yml`. After deploy:

```bash
# Health (no auth)
curl -s https://<your-api>/api/v1/health
# → {"status":"healthy"}

# Without token → 401
curl -s -o /dev/null -w "%{http_code}" https://<your-api>/api/v1/settings
# → 401

# With valid JWT → 200
curl -s -H "Authorization: Bearer <JWT>" https://<your-api>/api/v1/auth/me
# → user payload
```

---

## 6. Security and compliance

- **SecOps checklist** (complete before/after deploy): [docs/SECOPS_CHECKLIST.md](SECOPS_CHECKLIST.md)
- **Secrets audit**: [docs/SECURITY_AUDIT_SECRETS.md](SECURITY_AUDIT_SECRETS.md)
- **Auth**: JWT; all routes except `/api/v1/auth/*` and `/api/v1/health` require `Authorization: Bearer <token>`.
- **Credentials**: Stored encrypted in DB (Fernet); key from env only. No secrets in images.
- **HTTPS**: Production must use HTTPS; set `CORS_ALLOWED_ORIGINS` to the frontend origin.

---

## 7. Documentation and runbooks

| Doc | Purpose |
|-----|--------|
| [docs/deployment.md](deployment.md) | Full production deployment: architecture, env vars, migrations, backups, reverse proxy, troubleshooting; includes [example runbook](deployment.md#example-runbook-veelocitytoolingveesionio) for veelocity.tooling.veesion.io |
| [docs/SECOPS_CHECKLIST.md](SECOPS_CHECKLIST.md) | Security checklist for DevOps handoff |
| [docs/guides/github-oauth-setup.md](guides/github-oauth-setup.md) | Optional GitHub OAuth |
| **Config reference** | `backend/app/core/config.py` — all env vars and defaults |

---

## 8. Post-deploy (for SRE)

- **App configuration**: GitHub, Linear, Cursor, Greptile, Sentry are configured in the app **Settings** (gear icon), not via env (except encryption key).
- **Updates**: `git pull` then `docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d --build`. Migrations run on backend startup.
- **Backups**: See [deployment.md — Backups](deployment.md#backups).
- **Logs**: `docker compose -f infra/docker/docker-compose.prod.yml logs -f`.

---

## 9. Checklist to send to SRE

- [ ] Repository URL and branch (e.g. `main`) provided
- [ ] This handoff doc linked or attached
- [ ] [docs/deployment.md](deployment.md) and [docs/SECOPS_CHECKLIST.md](SECOPS_CHECKLIST.md) linked
- [ ] Target public URL and reverse proxy plan (TLS, routing) agreed
- [ ] Secrets: `POSTGRES_PASSWORD`, `VEELOCITY_ENCRYPTION_KEY`, `JWT_SECRET_KEY` — SRE will set (or use secrets manager); never commit `.env`
- [ ] `VITE_API_BASE_URL` and `CORS_ALLOWED_ORIGINS` set for production URL
- [ ] Notion form “[Asking for a new deployment](https://www.notion.so/Asking-for-a-new-deployment-30c16e5d54c08039a760d3392419dece)” filled with application name, repo, and link to this handoff
