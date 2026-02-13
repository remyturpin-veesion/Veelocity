# Security Audit: Secrets and Passwords

**Date:** 2025-02-13  
**Scope:** Encryption of secrets in the project and database, credential handling, and exposure risks.

---

## Summary

- **Secrets in database:** All API keys and tokens stored in the DB are encrypted at rest (Fernet).
- **Secrets in code/config:** No API keys or tokens are hardcoded; only the encryption key and DB URL are read from environment.
- **One fix applied:** OAuth callback no longer logs full GitHub response (could theoretically contain token).
- **Recommendations:** A few minor hardening items (see below).

---

## 1. Database: Encrypted Credentials

| Stored value                 | Column                         | Encrypted | Notes                          |
|-----------------------------|--------------------------------|-----------|--------------------------------|
| GitHub token                | `github_token_encrypted`       | Yes       | Fernet via `app/core/encryption.py` |
| Linear API key              | `linear_api_key_encrypted`     | Yes       | Same                          |
| Cursor API key              | `cursor_api_key_encrypted`     | Yes       | Same                          |
| Greptile API key            | `greptile_api_key_encrypted`   | Yes       | Same                          |
| Sentry API token            | `sentry_api_token_encrypted`   | Yes       | Same                          |
| GitHub repos / Linear workspace / Sentry org, etc. | Plain text columns | No (non-secret) | Config only, no credentials |

- **Model:** `backend/app/models/app_settings.py` — only encrypted columns hold secrets.
- **Service:** `backend/app/services/credentials.py` — `CredentialsService` encrypts on write and decrypts on read; `get_masked()` returns only booleans/config, never raw secrets.
- **Encryption:** `backend/app/core/encryption.py` — Fernet (symmetric), key from `VEELOCITY_ENCRYPTION_KEY` in env. If key is missing, the app refuses to store new secrets via Settings.

**Verdict:** Secrets in the database are encrypted at rest. No plaintext API keys or tokens in DB.

---

## 2. Environment and Configuration

- **`.env`**  
  - Root and `backend/` and `frontend-react/` `.gitignore` exclude `.env`, `.env.local`, and `*.env` (with `!.env.example`).  
  - `.env.example` files contain no real secrets; they document required vars and placeholders.

- **Secrets read from env (backend):**
  - `VEELOCITY_ENCRYPTION_KEY` — Fernet key for DB credential encryption (required to save keys in Settings).
  - `DATABASE_URL` — DB connection string (includes password); used only for DB connection, not logged in app code.
  - `GITHUB_OAUTH_CLIENT_SECRET` — OAuth client secret; used only in server-side token exchange, not stored in DB or logged.

- **Frontend:** Only reads `VITE_API_BASE_URL` and `VITE_SENTRY_DSN` from env; no secrets. Credentials are sent to the backend via HTTPS (PUT /settings); backend encrypts and stores.

**Verdict:** No credentials hardcoded. Env is the single source for encryption key and DB URL; `.env` is gitignored.

---

## 3. API and Settings

- **GET /api/v1/settings**  
  Returns `SettingsResponse`: booleans (`github_configured`, `linear_configured`, etc.), repo list, workspace/org names. No API keys or tokens.

- **PUT /api/v1/settings**  
  Accepts optional `SettingsUpdate` (e.g. `github_token`, `linear_api_key`, …). Backend encrypts each secret before persisting; empty string clears the key. If `VEELOCITY_ENCRYPTION_KEY` is unset, the backend returns 400 and does not store secrets.

**Verdict:** Settings API does not expose raw secrets; write path encrypts before storage.

---

## 4. Logging and Leaks

- **Fixed:** GitHub OAuth callback (`backend/app/api/v1/endpoints/auth.py`):
  - Previously logged full GitHub token-exchange response (`resp.text`, and `data` when `access_token` was missing), which could theoretically contain a token.
  - Now: on non-200 only status code is logged; on missing `access_token` only `error` and `error_description` are logged; on JSON parse failure only response length and exception are logged.

- **Checked:**  
  - `CredentialsService` and settings endpoints do not log request bodies or decrypted credentials.  
  - `greptile_client` logs only whether a GitHub token is “present” or “missing”, not the value.  
  - Other log lines use `resp.text[:200]` or similar for external API errors; these are third-party error bodies, not Veelocity secrets.  
  - `database_url` is not logged in the application.

**Verdict:** No remaining intentional logging of secrets; OAuth callback has been hardened.

---

## 5. Defaults and Repo-Contained Values

- **alembic.ini**  
  Contains `sqlalchemy.url = postgresql+asyncpg://veelocity:veelocity@localhost:5432/veelocity`.  
  Alembic’s `env.py` overrides this with `settings.database_url` from the app config (so real runs use `.env` or deployment env). The value in repo is a default dev password only.

- **backend/app/core/config.py**  
  Default `database_url` is the same dev default (port 5433 for local Docker). Production should set `DATABASE_URL` in env.

- **CI (.github/workflows/ci.yml)**  
  Sets `DATABASE_URL` to the same dev-style URL for tests. Acceptable for CI; ensure repo is private or that this is a dedicated CI-only DB.

**Verdict:** No production secrets in repo; only well-known dev defaults. For production, use strong `DATABASE_URL` and keep `.env` (and CI secrets) out of version control.

---

## 6. Recommendations

1. **OAuth / token exchange**  
   Done: do not log full response body or parsed `data` in the GitHub OAuth callback.

2. **Database URL in repo**  
   Consider removing the default password from `alembic.ini` (e.g. use a placeholder or require `env.py` to always set the URL from env) so that no password appears in the repo at all.

3. **Encryption key lifecycle**  
   Document key rotation: if `VEELOCITY_ENCRYPTION_KEY` is ever rotated, existing encrypted columns would need re-encryption (or support for dual-key decryption during rotation). Current design is single-key.

4. **HTTPS**  
   Ensure production is served over HTTPS so that credentials sent to PUT /settings and OAuth redirects are not sent in clear text.

5. **Optional: redact third-party response snippets**  
   Some clients log `resp.text[:200]` or `resp.text[:300]` on errors. If those APIs could ever return tokens or secrets, consider logging only status code and redacting or omitting body in logs.

---

## Conclusion

Secrets and passwords are encrypted in the database; the only secret in env is the encryption key (and DB URL). The Settings API does not return raw secrets, and the OAuth callback no longer logs response bodies that could contain tokens. The project is in good shape from a “secrets and encryption” perspective, with the above recommendations as optional hardening.
