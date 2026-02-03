import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '@/api/endpoints.js';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [githubRepos, setGithubRepos] = useState('');
  const [linearApiKey, setLinearApiKey] = useState('');
  const [linearWorkspaceName, setLinearWorkspaceName] = useState('');
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [linearConfigured, setLinearConfigured] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    getSettings()
      .then((data) => {
        setGithubRepos(data.github_repos ?? '');
        setLinearWorkspaceName(data.linear_workspace_name ?? '');
        setGithubConfigured(data.github_configured ?? false);
        setLinearConfigured(data.linear_configured ?? false);
        setStorageAvailable(data.storage_available ?? true);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = () => {
    if ((githubToken.trim() || linearApiKey.trim()) && !storageAvailable) {
      setError('Server cannot store API keys (encryption not configured).');
      return;
    }
    setSaving(true);
    setError(null);
    updateSettings({
      github_token: githubToken.trim() || undefined,
      github_repos: githubRepos.trim() || undefined,
      linear_api_key: linearApiKey.trim() || undefined,
      linear_workspace_name: linearWorkspaceName.trim() || undefined,
    })
      .then(() => {
        setGithubToken('');
        setLinearApiKey('');
        onClose();
      })
      .catch((e) => setError((e as Error).message))
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
        style={{ maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem' }}>Settings</h2>
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
        {!loading && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>GitHub token</label>
              <input
                type="password"
                placeholder={githubConfigured ? '•••••••• (leave blank to keep)' : 'Optional'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--surface-border)' }}
              />
              {githubConfigured && <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>GitHub is configured.</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>GitHub repos (owner/repo, comma-separated)</label>
              <input
                type="text"
                placeholder="owner/repo1,owner/repo2"
                value={githubRepos}
                onChange={(e) => setGithubRepos(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--surface-border)' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Linear API key</label>
              <input
                type="password"
                placeholder={linearConfigured ? '•••••••• (leave blank to keep)' : 'Optional'}
                value={linearApiKey}
                onChange={(e) => setLinearApiKey(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--surface-border)' }}
              />
              {linearConfigured && <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Linear is configured.</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Linear workspace name</label>
              <input
                type="text"
                placeholder="Optional"
                value={linearWorkspaceName}
                onChange={(e) => setLinearWorkspaceName(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--surface-border)' }}
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
