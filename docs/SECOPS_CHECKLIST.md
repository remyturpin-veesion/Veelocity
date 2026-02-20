# SecOps Checklist — DevOps Handoff

Use this checklist before and after deploying Veelocity to ensure security posture is correct.

---

## 1. Secrets and environment

| Item | Status | Notes |
|------|--------|--------|
| **`.env` never committed** | ☐ | Root and backend `.gitignore` exclude `.env` and `*.env`. Ensure `infra/docker/.env` is never committed. |
| **JWT_SECRET_KEY** | ☐ | **Required in production.** Long random value (e.g. `secrets.token_urlsafe(32)`). Set in env for backend; prod Compose requires it (`:?`). |
| **VEELOCITY_ENCRYPTION_KEY** | ☐ | **Required** to store GitHub/Linear/Cursor/Greptile/Sentry credentials in DB. Fernet key; generate with `Fernet.generate_key().decode()`. |
| **POSTGRES_PASSWORD** | ☐ | Strong password in production; prod Compose requires it. |
| **GitHub OAuth** (optional) | ☐ | If using "Connect with GitHub": set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `OAUTH_BACKEND_BASE_URL`, `OAUTH_FRONTEND_REDIRECT_URL`. Never commit these. |
| **Secrets source** | ☐ | Prefer a secrets manager (e.g. Vault, cloud provider secrets) or at least env files with restricted permissions; avoid defaults in production. |

---

## 2. Authentication and authorization

| Item | Status | Notes |
|------|--------|--------|
| **JWT** | ☐ | All API routes except `/api/v1/auth/*` and `/api/v1/health` require `Authorization: Bearer <token>`. |
| **Password hashing** | ☐ | bcrypt (SHA-256 pre-hash then bcrypt). No plaintext passwords stored. |
| **Inactive users** | ☐ | Inactive users get 403 on login; `get_current_user` rejects them. |
| **Public endpoints** | ☐ | Only: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (with valid token), `GET /auth/github/*`, `GET /api/v1/health`. Everything else requires auth. |

---

## 3. Data protection

| Item | Status | Notes |
|------|--------|--------|
| **Credentials at rest** | ☐ | GitHub/Linear/Cursor/Greptile/Sentry API keys stored encrypted in DB (Fernet). Key from `VEELOCITY_ENCRYPTION_KEY`. |
| **Settings API** | ☐ | GET /settings returns only masked state (booleans/config), never raw secrets. |
| **Logging** | ☐ | No tokens or API keys logged. OAuth callback logs only status/error fields, not response body. |

---

## 4. Network and deployment

| Item | Status | Notes |
|------|--------|--------|
| **HTTPS** | ☐ | Production must use HTTPS (reverse proxy or load balancer). Credentials and JWTs must not be sent over plain HTTP. |
| **CORS** | ☐ | Set `CORS_ALLOWED_ORIGINS` to the frontend origin(s) in production. Empty = allow all (dev-only). |
| **Database** | ☐ | PostgreSQL not exposed publicly; backend connects via internal URL. Use strong `POSTGRES_PASSWORD`. |
| **Health** | ☐ | `GET /api/v1/health` is unauthenticated for load balancer/k8s probes. No sensitive data returned. |

---

## 5. Application security

| Item | Status | Notes |
|------|--------|--------|
| **SQL injection** | ☐ | ORM/parameterized queries only; no raw SQL with user input. |
| **Input validation** | ☐ | Pydantic schemas (email, password length, etc.). Pagination limits enforced (max 100). |
| **Frontend token** | ☐ | JWT stored in localStorage (Zustand persist). XSS can steal it; ensure CSP and dependency hygiene. |
| **Login brute-force** | ☐ | No application-level rate limit on `/auth/login`. Consider WAF or rate limiting at reverse proxy for production. |

---

## 6. Docker and Compose

| Item | Status | Notes |
|------|--------|--------|
| **Prod env** | ☐ | `docker-compose.prod.yml` requires `POSTGRES_PASSWORD`, `VEELOCITY_ENCRYPTION_KEY`, `JWT_SECRET_KEY` (`:?`). |
| **Dev defaults** | ☐ | Dev Compose uses default JWT placeholder; do not use dev Compose for production. |
| **Secrets in images** | ☐ | No secrets baked into images; all from env at runtime. |

---

## 7. References

- **Secrets audit:** [docs/SECURITY_AUDIT_SECRETS.md](SECURITY_AUDIT_SECRETS.md)
- **Deployment:** [docs/deployment.md](deployment.md)
- **GitHub OAuth:** [docs/guides/github-oauth-setup.md](guides/github-oauth-setup.md)
- **Config (backend):** `backend/app/core/config.py` — all env vars and defaults

---

## Quick verification

After deployment:

```bash
# Health (no auth)
curl -s https://your-api/api/v1/health
# → {"status":"healthy"}

# Without token → 401
curl -s -o /dev/null -w "%{http_code}" https://your-api/api/v1/settings
# → 401

# With valid token → 200
curl -s -H "Authorization: Bearer YOUR_JWT" https://your-api/api/v1/auth/me
# → user payload
```

Ensure `JWT_SECRET_KEY` and `VEELOCITY_ENCRYPTION_KEY` are set and are not the default placeholders in production.
