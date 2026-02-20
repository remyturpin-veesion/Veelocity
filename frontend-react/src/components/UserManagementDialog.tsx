import { useEffect, useState } from 'react';
import { getUsers, setUserActive } from '@/api/endpoints.js';
import type { AuthUser } from '@/api/endpoints.js';

interface UserManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UserManagementDialog({ open, onClose }: UserManagementDialogProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleToggle(user: AuthUser) {
    if (togglingId != null) return;
    setTogglingId(user.id);
    try {
      const updated = await setUserActive(user.id, !user.is_active);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setTogglingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User management"
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
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>User management</h2>
          <button type="button" className="app-shell__icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
          {error && (
            <p style={{ color: 'var(--color-error, #f87171)', marginBottom: 12 }}>{error}</p>
          )}
          {!loading && users.length === 0 && !error && (
            <p style={{ color: 'var(--text-muted)' }}>No users yet.</p>
          )}
          {!loading && users.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {users.map((u) => (
                <li
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--surface-border)',
                    gap: 12,
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.email}>
                    {u.email}
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={u.is_active ?? false}
                      disabled={togglingId === u.id}
                      onChange={() => handleToggle(u)}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Active</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
