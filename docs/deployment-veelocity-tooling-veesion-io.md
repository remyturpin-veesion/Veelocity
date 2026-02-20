# Veelocity — Deployment to veelocity.tooling.veesion.io

DevOps runbook for **https://veelocity.tooling.veesion.io/**. All app configuration (GitHub, Linear, Cursor, Greptile) is done in the app via **Settings** (gear icon) after deploy.

**See also:** [Production deployment guide](deployment.md) — architecture, migrations, troubleshooting.

---

## 1. Target and architecture

| Item | Value |
|------|--------|
| **Public URL** | https://veelocity.tooling.veesion.io/ |
| **Stack** | Docker Compose (PostgreSQL + Backend + Frontend), reverse proxy for TLS |

- **Frontend**: nginx (e.g. port 80)
- **Backend**: FastAPI (e.g. port 8000)
- **PostgreSQL**: persistent data

Reverse proxy: TLS for `veelocity.tooling.veesion.io`, route `/api/*` → backend, `/` → frontend.

---

## 2. Prerequisites

- Docker Engine 24+ and Docker Compose v2
- DNS: `veelocity.tooling.veesion.io` → server (or LB)
- Reverse proxy with TLS (e.g. Caddy, Traefik)
- Secrets: `POSTGRES_PASSWORD`, `VEELOCITY_ENCRYPTION_KEY`

---

## 3. Environment variables

Create `infra/docker/.env` from `infra/docker/.env.example`. Set:

```bash
POSTGRES_USER=veelocity
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=veelocity
POSTGRES_PORT=5432
DEBUG=false

# Generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
VEELOCITY_ENCRYPTION_KEY=<your-fernet-key>

# Public URL (same host for app and API)
VITE_API_BASE_URL=https://veelocity.tooling.veesion.io
CORS_ALLOWED_ORIGINS=https://veelocity.tooling.veesion.io
```

**Note:** `VITE_API_BASE_URL` is baked at build time; after changing it, rebuild the frontend.

---

## 4. Reverse proxy (example: Caddy)

```caddyfile
veelocity.tooling.veesion.io {
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:80
    }
}
```

---

## 5. Deploy

```bash
git clone <repo-url> veelocity && cd veelocity
cp infra/docker/.env.example infra/docker/.env
# Edit infra/docker/.env with the values above

# From repo root, use --env-file so .env is loaded
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d --build
```

**Verify:**  
- `curl -s https://veelocity.tooling.veesion.io/api/v1/health` → `{"status":"healthy"}`  
- Open https://veelocity.tooling.veesion.io/ → Settings (gear) → configure GitHub, Linear, etc.

---

## 6. Updates and maintenance

- **Update:** `git pull` then `docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d --build`
- **Backups:** see [deployment.md](deployment.md#backups)
- **Logs:** `docker compose -f infra/docker/docker-compose.prod.yml logs -f`

---

## 7. Checklist

- [ ] DNS: `veelocity.tooling.veesion.io` → server
- [ ] Reverse proxy: TLS, `/api/*` → backend, `/` → frontend
- [ ] `infra/docker/.env`: `POSTGRES_PASSWORD`, `VEELOCITY_ENCRYPTION_KEY`, `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `DEBUG=false`
- [ ] Run compose with `--env-file infra/docker/.env`
- [ ] Health check and open app; configure data sources in **Settings**
