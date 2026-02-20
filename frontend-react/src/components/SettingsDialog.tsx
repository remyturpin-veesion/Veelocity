import { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings, getGitHubOAuthStatus, updateSettings, testSentryConnection } from '@/api/endpoints.js';
import { baseUrl } from '@/api/client.js';
import { GitHubRepoMultiSelect } from '@/components/GitHubRepoMultiSelect.js';

const SETTINGS_CATEGORY_IDS = ['github', 'cursor', 'greptile', 'sentry', 'linear'] as const;
type SettingsCategoryId = (typeof SETTINGS_CATEGORY_IDS)[number];

const defaultExpanded: Record<SettingsCategoryId, boolean> = {
  github: false,
  cursor: false,
  greptile: false,
  sentry: false,
  linear: false,
};

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
  const [sentryConfigured, setSentryConfigured] = useState(false);
  const [sentryBaseUrl, setSentryBaseUrl] = useState('https://sentry.tooling.veesion.io');
  const [sentryOrg, setSentryOrg] = useState('');
  const [sentryProject, setSentryProject] = useState('');
  const [sentryApiKey, setSentryApiKey] = useState('');
  const [sentryTestLoading, setSentryTestLoading] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [githubOAuthEnabled, setGithubOAuthEnabled] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SettingsCategoryId, boolean>>(defaultExpanded);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const expandAll = () => setExpandedSections({ github: true, cursor: true, greptile: true, sentry: true, linear: true });
  const collapseAll = () => setExpandedSections({ ...defaultExpanded });
  const toggleSection = (id: SettingsCategoryId) =>
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; dialogX: number; dialogY: number } | null>(null);
  const setDraggingRef = useRef(setIsDragging);
  setDraggingRef.current = setIsDragging;

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !dialogRef.current) return;
    const rect = dialogRef.current.getBoundingClientRect();
    setDialogPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, dialogX: rect.left, dialogY: rect.top };
  }, []);

  useEffect(() => {
    if (!open) {
      setDialogPosition(null);
      setIsDragging(false);
      dragStartRef.current = null;
      return;
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { mouseX, mouseY, dialogX, dialogY } = dragStartRef.current;
      const newX = dialogX + (e.clientX - mouseX);
      const newY = dialogY + (e.clientY - mouseY);
      setDialogPosition({ x: newX, y: newY });
      dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, dialogX: newX, dialogY: newY };
    };
    const onMouseUp = () => {
      dragStartRef.current = null;
      setDraggingRef.current(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset state when dialog opens
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
        setSentryConfigured(settingsData.sentry_configured ?? false);
        setSentryBaseUrl(settingsData.sentry_base_url?.trim() || 'https://sentry.tooling.veesion.io');
        setSentryOrg(settingsData.sentry_org ?? '');
        setSentryProject(settingsData.sentry_project ?? '');
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
      /* eslint-disable react-hooks/set-state-in-effect -- Intentional: handle OAuth redirect params on dialog open */
      if (oauthError === 'not_configured') {
        setError('GitHub OAuth is not configured on the server (missing client ID/secret).');
      } else if (oauthError === 'encryption_required') {
        setError('Server cannot store the token: set VEELOCITY_ENCRYPTION_KEY in the backend .env.');
      } else if (oauthError === 'callback_failed') {
        setError('GitHub connection failed or was denied.');
      } else if (connected === '1') {
        setError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
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

  const handleSaveSentry = () => {
    if (sentryApiKey.trim() && !storageAvailable) {
      setError('Server cannot store API keys (encryption not configured).');
      return;
    }
    setSaving(true);
    setError(null);
    updateSettings({
      sentry_api_token: sentryApiKey.trim() || undefined,
      sentry_base_url: sentryBaseUrl.trim() || 'https://sentry.tooling.veesion.io',
      sentry_org: sentryOrg.trim(),
      sentry_project: sentryProject.trim(),
    })
      .then((data) => {
        setSentryApiKey('');
        setSentryConfigured(data.sentry_configured ?? false);
        setSentryBaseUrl(data.sentry_base_url?.trim() || 'https://sentry.tooling.veesion.io');
        setSentryOrg(data.sentry_org ?? '');
        setSentryProject(data.sentry_project ?? '');
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleDisconnectSentry = () => {
    setSaving(true);
    setError(null);
    updateSettings({ sentry_api_token: '' })
      .then(() => {
        setSentryConfigured(false);
        setSentryApiKey('');
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleTestSentry = () => {
    setSentryTestLoading(true);
    setError(null);
    testSentryConnection()
      .then(() => setError(null))
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setSentryTestLoading(false));
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
        ref={dialogRef}
        className="card"
        style={{
          maxWidth: 720,
          width: '95%',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--surface)',
          position: dialogPosition !== null ? ('fixed' as const) : 'relative',
          ...(dialogPosition !== null && { left: dialogPosition.x, top: dialogPosition.y }),
          zIndex: 1,
          paddingBottom: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
            onMouseDown={handleDragStart}
          >
            Settings
          </h2>
          {!loading && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={expandAll}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--surface-border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--surface-border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Collapse all
              </button>
            </div>
          )}
        </div>
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
        {!loading && (
          <>
            <section
              className={`settings-section settings-section--github${!expandedSections.github ? ' settings-section--collapsed' : ''}`}
              aria-labelledby="settings-github-title"
            >
              <div
                className="settings-section__header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection('github')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSection('github'))}
                aria-expanded={expandedSections.github}
              >
                <div className="settings-section__icon" aria-hidden>G</div>
                <div className="settings-section__title-wrap">
                  <h3 id="settings-github-title" className="settings-section__title">GitHub</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
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
                <span className="settings-section__chevron" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              {expandedSections.github && (
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
              )}
            </section>

            <section
              className={`settings-section settings-section--cursor${!expandedSections.cursor ? ' settings-section--collapsed' : ''}`}
              aria-labelledby="settings-cursor-title"
            >
              <div
                className="settings-section__header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection('cursor')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSection('cursor'))}
                aria-expanded={expandedSections.cursor}
              >
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
                <span className="settings-section__chevron" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              {expandedSections.cursor && (
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
              )}
            </section>

            <section
              className={`settings-section settings-section--greptile${!expandedSections.greptile ? ' settings-section--collapsed' : ''}`}
              aria-labelledby="settings-greptile-title"
            >
              <div
                className="settings-section__header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection('greptile')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSection('greptile'))}
                aria-expanded={expandedSections.greptile}
              >
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
                <span className="settings-section__chevron" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              {expandedSections.greptile && (
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
              )}
            </section>

            <section
              className={`settings-section settings-section--sentry${!expandedSections.sentry ? ' settings-section--collapsed' : ''}`}
              aria-labelledby="settings-sentry-title"
            >
              <div
                className="settings-section__header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection('sentry')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSection('sentry'))}
                aria-expanded={expandedSections.sentry}
              >
                <div className="settings-section__icon" aria-hidden>S</div>
                <div className="settings-section__title-wrap">
                  <h3 id="settings-sentry-title" className="settings-section__title">Sentry</h3>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: sentryConfigured ? 'var(--success-bg, rgba(34, 197, 94, 0.15))' : 'var(--surface)',
                      color: sentryConfigured ? 'var(--success-fg, #22c55e)' : 'var(--text-muted)',
                      border: '1px solid ' + (sentryConfigured ? 'var(--success-border, rgba(34, 197, 94, 0.4))' : 'var(--surface-border)'),
                    }}
                  >
                    {sentryConfigured ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <span className="settings-section__chevron" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              {expandedSections.sentry && (
              <div className="settings-section__body">
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Connect Sentry to link to your project and test the API. Create an auth token in Sentry → Settings → Account → API → Auth Tokens (scopes: project:read, event:read, org:read).
                </p>
                <label style={{ display: 'block', marginTop: 12, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Base URL</label>
                <input
                  type="text"
                  placeholder="https://sentry.tooling.veesion.io"
                  value={sentryBaseUrl}
                  onChange={(e) => setSentryBaseUrl(e.target.value)}
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
                <label style={{ display: 'block', marginTop: 8, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Org slug</label>
                <input
                  type="text"
                  placeholder="my-org"
                  value={sentryOrg}
                  onChange={(e) => setSentryOrg(e.target.value)}
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
                <label style={{ display: 'block', marginTop: 8, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Project slug</label>
                <input
                  type="text"
                  placeholder="my-project"
                  value={sentryProject}
                  onChange={(e) => setSentryProject(e.target.value)}
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
                <label style={{ display: 'block', marginTop: 8, marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Sentry API token</label>
                <input
                  type="password"
                  placeholder={sentryConfigured ? '•••••••• (leave blank to keep)' : 'Paste your auth token'}
                  value={sentryApiKey}
                  onChange={(e) => setSentryApiKey(e.target.value)}
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
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSaveSentry}
                    disabled={saving}
                    className="settings-dialog__btn settings-dialog__btn--primary"
                  >
                    {sentryConfigured ? 'Update' : 'Connect Sentry'}
                  </button>
                  {sentryConfigured && (
                    <button
                      type="button"
                      onClick={handleTestSentry}
                      disabled={sentryTestLoading}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: '1px solid var(--surface-border)',
                        background: 'transparent',
                        color: 'var(--text)',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: sentryTestLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {sentryTestLoading ? 'Testing…' : 'Test connection'}
                    </button>
                  )}
                  {sentryConfigured && sentryBaseUrl && (
                    <a
                      href={sentryOrg ? `${sentryBaseUrl.replace(/\/$/, '')}/organizations/${sentryOrg}/issues/` : `${sentryBaseUrl.replace(/\/$/, '')}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.875rem', color: 'var(--link)' }}
                    >
                      Open in Sentry
                    </a>
                  )}
                  {sentryConfigured && (
                    <button
                      type="button"
                      onClick={handleDisconnectSentry}
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
              )}
            </section>

            <section
              className={`settings-section settings-section--linear${!expandedSections.linear ? ' settings-section--collapsed' : ''}`}
              aria-labelledby="settings-linear-title"
            >
              <div
                className="settings-section__header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection('linear')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSection('linear'))}
                aria-expanded={expandedSections.linear}
              >
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
                <span className="settings-section__chevron" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              {expandedSections.linear && (
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
              )}
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
