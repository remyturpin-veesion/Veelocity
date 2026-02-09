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
  const [cursorConfigured, setCursorConfigured] = useState(false);
  const [cursorApiKey, setCursorApiKey] = useState('');
  const [greptileConfigured, setGreptileConfigured] = useState(false);
  const [greptileApiKey, setGreptileApiKey] = useState('');
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
        setCursorConfigured(settingsData.cursor_configured ?? false);
        setGreptileConfigured(settingsData.greptile_configured ?? false);
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

  const handleSaveCursor = () => {
    if (cursorApiKey.trim() && !storageAvailable) {
      setError('Server cannot store API keys (encryption not configured).');
      return;
    }
    setSaving(true);
    setError(null);
    updateSettings({ cursor_api_key: cursorApiKey.trim() || undefined })
      .then((data) => {
        setCursorApiKey('');
        setCursorConfigured(data.cursor_configured ?? false);
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleDisconnectCursor = () => {
    setSaving(true);
    setError(null);
    updateSettings({ cursor_api_key: '' })
      .then(() => {
        setCursorConfigured(false);
        setCursorApiKey('');
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleSaveGreptile = () => {
    if (greptileApiKey.trim() && !storageAvailable) {
      setError('Server cannot store API keys (encryption not configured).');
      return;
    }
    setSaving(true);
    setError(null);
    updateSettings({ greptile_api_key: greptileApiKey.trim() || undefined })
      .then((data) => {
        setGreptileApiKey('');
        setGreptileConfigured(data.greptile_configured ?? false);
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleDisconnectGreptile = () => {
    setSaving(true);
    setError(null);
    updateSettings({ greptile_api_key: '' })
      .then(() => {
        setGreptileConfigured(false);
        setGreptileApiKey('');
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
          maxWidth: 520,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--surface)',
          position: 'relative',
          zIndex: 1,
          paddingBottom: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: '1.25rem', fontWeight: 600 }}>Settings</h2>
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
        {!loading && (
          <>
            <section className="settings-section settings-section--github" aria-labelledby="settings-github-title">
              <div className="settings-section__header">
                <div className="settings-section__icon" aria-hidden>G</div>
                <div className="settings-section__title-wrap">
                  <h3 id="settings-github-title" className="settings-section__title">GitHub</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: (githubConfigured || githubHasToken) ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface)',
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
                            background: (githubConfigured || githubHasToken) ? 'transparent' : 'var(--surface)',
                            border: '1px solid var(--surface-border)',
                            color: 'var(--text)',
                            textDecoration: 'none',
                            fontWeight: 500,
                            fontSize: '0.8125rem',
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
                              fontSize: '0.8125rem',
                              cursor: saving ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Déconnecter
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="settings-section__body">
                {githubOAuthEnabled ? (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {(githubConfigured || githubHasToken) ? (githubConfigured ? 'Use a different account or refresh access.' : 'Token is set. Select repos or an entire organization below, then Save to start syncing.') : 'Sign in with GitHub to grant access.'}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Configure GitHub OAuth on the server (GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET) to connect.
                  </p>
                )}
                <label style={{ display: 'block', marginTop: 12, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>
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
                  <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Select repos or import an entire organization above, then click Save to start syncing.
                  </p>
                )}
              </div>
            </section>

            <section className="settings-section settings-section--cursor" aria-labelledby="settings-cursor-title">
              <div className="settings-section__header">
                <div className="settings-section__icon" aria-hidden>C</div>
                <div className="settings-section__title-wrap">
                  <h3 id="settings-cursor-title" className="settings-section__title">Cursor</h3>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: cursorConfigured ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface)',
                      color: cursorConfigured ? 'var(--success-fg, #22c55e)' : 'var(--text-muted)',
                      border: '1px solid ' + (cursorConfigured ? 'var(--success-border, rgba(34, 197, 94, 0.4))' : 'var(--surface-border)'),
                    }}
                  >
                    {cursorConfigured ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <div className="settings-section__body">
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Connect your Cursor team via Admin API key to see team size, usage, and spend on the dashboard. Create a key in{' '}
                  <a href="https://cursor.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>Cursor Dashboard</a>
                  {' '}→ Settings → Advanced → Admin API Keys.
                </p>
                <label style={{ display: 'block', marginTop: 12, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Cursor API key</label>
                <input
                  type="password"
                  placeholder={cursorConfigured ? '•••••••• (leave blank to keep)' : 'key_...'}
                  value={cursorApiKey}
                  onChange={(e) => setCursorApiKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSaveCursor}
                    disabled={saving}
                    className="settings-dialog__btn settings-dialog__btn--primary"
                  >
                    {cursorConfigured ? 'Update key' : 'Connect Cursor'}
                  </button>
                  {cursorConfigured && (
                    <button
                      type="button"
                      onClick={handleDisconnectCursor}
                      disabled={saving}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: '1px solid var(--surface-border)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section settings-section--greptile" aria-labelledby="settings-greptile-title">
              <div className="settings-section__header">
                <div className="settings-section__icon" aria-hidden>G</div>
                <div className="settings-section__title-wrap">
                  <h3 id="settings-greptile-title" className="settings-section__title">Greptile</h3>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: greptileConfigured ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface)',
                      color: greptileConfigured ? 'var(--success-fg, #22c55e)' : 'var(--text-muted)',
                      border: '1px solid ' + (greptileConfigured ? 'var(--success-border, rgba(34, 197, 94, 0.4))' : 'var(--surface-border)'),
                    }}
                  >
                    {greptileConfigured ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <div className="settings-section__body">
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Connect Greptile to see indexed repositories and codebase metrics on the dashboard. Get your API key at{' '}
                  <a href="https://app.greptile.com/api" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>app.greptile.com/api</a>.
                </p>
                <label style={{ display: 'block', marginTop: 12, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Greptile API key</label>
                <input
                  type="password"
                  placeholder={greptileConfigured ? '•••••••• (leave blank to keep)' : 'Paste your API key'}
                  value={greptileApiKey}
                  onChange={(e) => setGreptileApiKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSaveGreptile}
                    disabled={saving}
                    className="settings-dialog__btn settings-dialog__btn--primary"
                  >
                    {greptileConfigured ? 'Update key' : 'Connect Greptile'}
                  </button>
                  {greptileConfigured && (
                    <button
                      type="button"
                      onClick={handleDisconnectGreptile}
                      disabled={saving}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: '1px solid var(--surface-border)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section settings-section--linear" aria-labelledby="settings-linear-title">
              <div className="settings-section__header">
                <div className="settings-section__icon" aria-hidden>L</div>
                <div className="settings-section__title-wrap">
                  <h3 id="settings-linear-title" className="settings-section__title">Linear</h3>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: linearConfigured ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface)',
                      color: linearConfigured ? 'var(--success-fg, #22c55e)' : 'var(--text-muted)',
                      border: '1px solid ' + (linearConfigured ? 'var(--success-border, rgba(34, 197, 94, 0.4))' : 'var(--surface-border)'),
                    }}
                  >
                    {linearConfigured ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <div className="settings-section__body">
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Linear API key</label>
                <input
                  type="password"
                  placeholder={linearConfigured ? '•••••••• (leave blank to keep)' : 'Optional'}
                  value={linearApiKey}
                  onChange={(e) => setLinearApiKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                  }}
                />
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Linear workspace name</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={linearWorkspaceName}
                  onChange={(e) => setLinearWorkspaceName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </section>

            <footer className="settings-dialog__footer">
              <button type="button" onClick={onClose} className="settings-dialog__btn settings-dialog__btn--secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="settings-dialog__btn settings-dialog__btn--primary"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
