import { useCallback, useEffect, useRef, useState } from 'react';
import { getUsers, setUserActive, changePassword } from '@/api/endpoints.js';
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
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'me' | 'users'>('me');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPosition(null);
    setIsDragging(false);
    setPasswordError(null);
    setPasswordSuccess(false);
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setActiveTab('me');
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [open]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const card = e.currentTarget.closest('.card') as HTMLElement | null;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPosition({
      x: d.startLeft + (e.clientX - d.startX),
      y: d.startTop + (e.clientY - d.startY),
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

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

  const handleChangePassword = () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!currentPassword.trim()) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    changePassword(currentPassword, newPassword, newPasswordConfirm)
      .then(() => {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
      })
      .catch((e) => setPasswordError(e instanceof Error ? e.message : String(e)))
      .finally(() => setPasswordSaving(false));
  };

  if (!open) return null;

  const cardStyle: React.CSSProperties = {
    maxWidth: 480,
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    background: 'var(--surface)',
    zIndex: 1,
    padding: 24,
    position: 'fixed',
    ...(position === null
      ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
      : { left: position.x, top: position.y }),
  };

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
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          role="presentation"
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>User management</h2>
          <button type="button" className="app-shell__icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div
          role="tablist"
          aria-label="User management sections"
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 16,
            borderBottom: '1px solid var(--surface-border)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'me'}
            aria-controls="user-mgmt-me-panel"
            id="user-mgmt-me-tab"
            onClick={() => setActiveTab('me')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'me' ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'none',
              color: activeTab === 'me' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            Me
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            aria-controls="user-mgmt-users-panel"
            id="user-mgmt-users-tab"
            onClick={() => setActiveTab('users')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'none',
              color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            Users list
          </button>
        </div>
        <div>
          {activeTab === 'me' && (
          <section
            id="user-mgmt-me-panel"
            role="tabpanel"
            aria-labelledby="user-mgmt-me-tab"
            style={{ marginBottom: 24 }}
          >
            <h3 id="user-mgmt-password-title" style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600 }}>Update your password</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Change your account password. Enter your current password and your new password twice to confirm.
            </p>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Current password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                marginBottom: 8,
              }}
            />
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>New password</label>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                marginBottom: 8,
              }}
            />
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Confirm new password</label>
            <input
              type="password"
              placeholder="Repeat new password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                marginBottom: 8,
              }}
            />
            {passwordError && <div className="error" style={{ marginTop: 4, marginBottom: 8 }}>{passwordError}</div>}
            {passwordSuccess && (
              <p style={{ margin: '4px 0 8px', fontSize: '0.875rem', color: 'var(--success-fg, #22c55e)' }}>Password updated successfully.</p>
            )}
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={passwordSaving}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--primary)',
                color: 'var(--primary-fg)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: passwordSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {passwordSaving ? 'Updating…' : 'Update password'}
            </button>
          </section>
          )}
          {activeTab === 'users' && (
          <section
            id="user-mgmt-users-panel"
            role="tabpanel"
            aria-labelledby="user-mgmt-users-tab"
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600 }}>Users</h3>
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
          </section>
          )}
        </div>
      </div>
    </div>
  );
}
