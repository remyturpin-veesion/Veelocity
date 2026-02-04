# Cursor connection

Veelocity can show **Cursor** team data (team size, daily active users, spend) on the Dashboard and on the **Cursor** page. Cursor does **not** offer OAuth; connection is via an **API key** (like Linear).

## 1. Create a Cursor API key

1. Open [Cursor Dashboard](https://cursor.com/dashboard) and sign in.
2. Go to **Settings** → **Advanced** → **Admin API Keys**.
3. Click **Create New API Key**, name it (e.g. "Veelocity"), and copy the key.
4. Key format: `key_xxxxxxxx...` — store it securely; you won’t see it again.

**Note:** Analytics (e.g. Daily Active Users) requires an **Enterprise** team. Admin API (team members, spend, daily usage) is available for Enterprise teams.

## 2. Connect in Veelocity

1. In Veelocity, open **Settings** (gear icon).
2. In the **Cursor** section, paste your API key.
3. Click **Connect Cursor** (or **Update key** if already connected).
4. Save. The Dashboard will show a Cursor block and the **Cursor** tab will show the full overview.

## 3. What you see

- **Dashboard block:** Team members count, current cycle spend, DAU (7d) when connected.
- **Cursor page:** Team members, spend, DAU over time, and a short usage summary.

## 4. Disconnect

In Settings → Cursor, click **Disconnect** and save. The key is removed from the database.

## 5. Security

- The API key is stored **encrypted** in the database (same as GitHub token and Linear API key).
- Set `VEELOCITY_ENCRYPTION_KEY` in the backend `.env`; otherwise the key cannot be saved.

## Summary

1. Create an Admin API key in Cursor Dashboard → Settings → Advanced → Admin API Keys.
2. In Veelocity Settings → Cursor, paste the key and click Connect Cursor.
3. Dashboard and Cursor page will show team and usage data.

There is no OAuth app for Cursor; only API key authentication is supported.
