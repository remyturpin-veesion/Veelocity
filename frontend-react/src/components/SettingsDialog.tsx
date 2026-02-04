import { useState, useEffect } from 'react';
import { getSettings, getGitHubOAuthStatus, updateSettings } from '@/api/endpoints.js';
import { baseUrl } from '@/api/client.js';
import { GitHubRepoMultiSelect } from '@/components/GitHubRepoMultiSelect.js';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatApiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return `Cannot reach the API at ${baseUrl}. Check that the backend is running (e.g. \`make dev\` or \`make dev-local\`) and that VITE_API_BASE_URL in .env points to it.`;
  }
  return msg;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubRepos, setGithubRepos] = useState('');
  const [linearApiKey, setLinearApiKey] = useState('');
  const [linearWorkspaceName, setLinearWorkspaceName] = useState('');
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubHasToken, setGithubHasToken] = useState(false);
  const [linearConfigured, setLinearConfigured] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [githubOAuthEnabled, setGithubOAuthEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    Promise.all([getSettings(), getGitHubOAuthStatus()])
      .then(([settingsData, oauthData]) => {
        setGithubRepos(settingsData.github_repos ?? '');
        setLinearWorkspaceName(settingsData.linear_workspace_name ?? '');
        setGithubConfigured(settingsData.github_configured ?? false);
        setGithubHasToken(settingsData.github_has_token ?? false);
        setLinearConfigured(settingsData.linear_configured ?? false);
        setStorageAvailable(settingsData.storage_available ?? true);
        setGithubOAuthEnabled(oauthData?.enabled ?? false);
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [open]);

  // Handle redirect back from GitHub OAuth (success or error in URL)
  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('github_connected');
    const oauthError = params.get('github_oauth_error');
    if (connected === '1' || oauthError) {
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', newUrl);
      if (oauthError === 'not_configured') {
        setError('GitHub OAuth is not configured on the server (missing client ID/secret).');
      } else if (oauthError === 'encryption_required') {
        setError('Server cannot store the token: set VEELOCITY_ENCRYPTION_KEY in the backend .env.');
      } else if (oauthError === 'callback_failed') {
        setError('GitHub connection failed or was denied.');
      } else if (connected === '1') {
        setError(null);
        getSettings().then((data) => {
          setGithubConfigured(data.github_configured ?? false);
          setGithubHasToken(data.github_has_token ?? false);
          setGithubRepos(data.github_repos ?? '');
        });
      }
    }
  }, [open]);

  const handleSave = () => {
    if (linearApiKey.trim() && !storageAvailable) {
      setError('Server cannot store API keys (encryption not configured).');
      return;
    }
    setSaving(true);
    setError(null);
    updateSettings({
      github_repos: githubRepos.trim() || undefined,
      linear_api_key: linearApiKey.trim() || undefined,
      linear_workspace_name: linearWorkspaceName.trim() || undefined,
    })
      .then(() => {
        setLinearApiKey('');
        onClose();
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleDisconnectGitHub = () => {
    setSaving(true);
    setError(null);
    updateSettings({ github_token: '' })
      .then(() => {
        setGithubRepos('');
        setGithubConfigured(false);
        setGithubHasToken(false);
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--surface)',
          position: 'relative',
          zIndex: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem' }}>Settings</h2>
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
        {!loading && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <label style={{ margin: 0, fontWeight: 500 }}>GitHub</label>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: (githubConfigured || githubHasToken) ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface-elevated)',
                    color: (githubConfigured || githubHasToken) ? 'var(--success-fg, #22c55e)' : 'var(--text-muted)',
                    border: '1px solid ' + ((githubConfigured || githubHasToken) ? 'var(--success-border, rgba(34, 197, 94, 0.4))' : 'var(--surface-border)'),
                  }}
                >
                  {githubConfigured ? 'Connected' : githubHasToken ? 'Token set' : 'Not connected'}
                </span>
                {githubOAuthEnabled && (
                  <>
                    <a
                      href={`${baseUrl}/api/v1/auth/github`}
                      target="_self"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: (githubConfigured || githubHasToken) ? 'transparent' : 'var(--surface-elevated)',
                        border: '1px solid var(--surface-border)',
                        color: 'var(--text)',
                        textDecoration: 'none',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                      }}
                    >
                      {(githubConfigured || githubHasToken) ? 'Reconnect with GitHub' : 'Connect with GitHub'}
                    </a>
                    {(githubConfigured || githubHasToken) && (
                      <button
                        type="button"
                        onClick={handleDisconnectGitHub}
                        disabled={saving}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--surface-border)',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Déconnecter
                      </button>
                    )}
                  </>
                )}
              </div>
              {githubOAuthEnabled ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {(githubConfigured || githubHasToken) ? (githubConfigured ? 'Use a different account or refresh access.' : 'Token is set. Add repos below and Save to start syncing.') : 'Sign in with GitHub to grant access.'}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Configure GitHub OAuth on the server (GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET) to connect.
                </p>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                GitHub repositories
              </label>
              <GitHubRepoMultiSelect
                value={githubRepos}
                onChange={setGithubRepos}
                disabled={!githubHasToken}
                placeholder={
                  githubHasToken
                    ? 'Search and select repositories…'
                    : 'Connect with GitHub to search repositories'
                }
              />
              {githubHasToken && !githubConfigured && (
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Add at least one repo above and click Save to start syncing.
                </p>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ margin: 0, fontWeight: 500 }}>Linear</label>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: linearConfigured ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface-elevated)',
                    color: linearConfigured ? 'var(--success-fg, #22c55e)' : 'var(--text-muted)',
                    border: '1px solid ' + (linearConfigured ? 'var(--success-border, rgba(34, 197, 94, 0.4))' : 'var(--surface-border)'),
                  }}
                >
                  {linearConfigured ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Linear API key</label>
              <input
                type="password"
                placeholder={linearConfigured ? '•••••••• (leave blank to keep)' : 'Optional'}
                value={linearApiKey}
                onChange={(e) => setLinearApiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--surface-border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Linear workspace name</label>
              <input
                type="text"
                placeholder="Optional"
                value={linearWorkspaceName}
                onChange={(e) => setLinearWorkspaceName(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--surface-border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
