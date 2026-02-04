# Step-by-step: GitHub OAuth connection

This guide explains how to set up **GitHub OAuth** so users can connect their GitHub account from Settings with **"Connect with GitHub"** instead of pasting a Personal Access Token (PAT).

---

## 1. Create a GitHub OAuth App

1. Open **GitHub** → **Settings** (your profile) → **Developer settings** → **OAuth Apps**.
2. Click **"New OAuth App"** (or "Register a new application").
3. Fill in:
   - **Application name:** e.g. `Veelocity` or `Veelocity (local)`.
   - **Homepage URL:**  
     - Local: `http://localhost:5173`  
     - Production: your frontend URL (e.g. `https://app.veelocity.example.com`).
   - **Authorization callback URL:**  
     This must be the **backend** URL where GitHub will send the user after they authorize.
   - **Local:** `http://localhost:8000/api/v1/auth/github/callback`
   - **Production:** `https://api.veelocity.example.com/api/v1/auth/github/callback`  
     (Replace with your real backend base URL + `/api/v1/auth/github/callback`.)
4. Click **"Register application"**.
5. On the app page:
   - Copy the **Client ID**.
   - Click **"Generate a new client secret"**, copy the **Client secret** (you won’t see it again).

---

## 2. Configure the backend

Add these to your backend environment (e.g. `backend/.env` or `infra/docker/.env`):

```env
# Required for OAuth
GITHUB_OAUTH_CLIENT_ID=your_client_id_here
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret_here

# Callback URL is built from this (must match what you set in GitHub)
OAUTH_BACKEND_BASE_URL=http://localhost:8000

# Where to send the user after successful login (usually your frontend)
OAUTH_FRONTEND_REDIRECT_URL=http://localhost:5173
```

- **Local:**  
  - `OAUTH_BACKEND_BASE_URL=http://localhost:8000`  
  - `OAUTH_FRONTEND_REDIRECT_URL=http://localhost:5173`
- **Production:**  
  - `OAUTH_BACKEND_BASE_URL=https://your-backend-domain.com`  
  - `OAUTH_FRONTEND_REDIRECT_URL=https://your-frontend-domain.com`

Restart the backend after changing these.

---

## 3. Encryption (required to store the token)

The backend stores the OAuth token in the database **encrypted**. You must set:

```env
VEELOCITY_ENCRYPTION_KEY=your_fernet_key
```

Generate a key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Without this, the callback will redirect with `github_oauth_error=encryption_required`.

---

## 4. Use it in the app

1. Start backend and frontend (e.g. `make dev` and `make dev-frontend`).
2. Open **Settings** (gear icon).
3. If OAuth is configured, you’ll see **"Connect with GitHub"**.
4. Click it → you’re sent to GitHub to authorize → then back to the app; the token is saved.
5. Add **GitHub repos** (owner/repo, comma-separated) and **Save** if needed.

The token obtained via OAuth is used the same way as a pasted PAT (repos, PRs, Actions). You can still paste a PAT in the "Or paste a Personal Access Token" field if you prefer.

---

## 5. Troubleshooting

| Issue | What to check |
|--------|----------------|
| No "Connect with GitHub" button | Backend has `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` set and was restarted. |
| Redirect to frontend with `github_oauth_error=not_configured` | Same as above. |
| Redirect with `github_oauth_error=encryption_required` | Set `VEELOCITY_ENCRYPTION_KEY` in backend env. |
| Redirect with `github_oauth_error=callback_failed` | Callback URL in GitHub must match `OAUTH_BACKEND_BASE_URL` + `/api/v1/auth/github/callback`. User may have denied access. |
| GitHub shows "redirect_uri_mismatch" | The **Authorization callback URL** in the GitHub OAuth App must be exactly `OAUTH_BACKEND_BASE_URL` + `/api/v1/auth/github/callback` (no trailing slash). |

---

## Summary

1. **GitHub:** Create OAuth App → copy Client ID and Client secret → set **Authorization callback URL** to your backend callback URL.
2. **Backend:** Set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `OAUTH_BACKEND_BASE_URL`, `OAUTH_FRONTEND_REDIRECT_URL`, and `VEELOCITY_ENCRYPTION_KEY`.
3. **App:** Open Settings → click **Connect with GitHub** → authorize → add repos and save.

After that, GitHub is connected via OAuth and can replace the need to paste a token.
