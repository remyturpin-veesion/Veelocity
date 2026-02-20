import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.js';
import { register } from '@/api/endpoints.js';
import type { RegisterPendingResponse, TokenResponse } from '@/api/endpoints.js';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => Boolean(s.token));
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await register(email.trim(), password);
      if ('access_token' in data && data.access_token) {
        setAuth((data as TokenResponse).access_token, (data as TokenResponse).user);
        navigate('/', { replace: true });
      } else {
        setSuccessMessage((data as RegisterPendingResponse).message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg, #0f172a)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          borderRadius: 12,
          background: 'var(--color-surface, #1e293b)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img src="/Veelocity.png" alt="Veelocity" style={{ height: 48 }} />
        </div>
        <h1 style={{ margin: '0 0 24px', fontSize: 22, color: 'var(--color-text, #f1f5f9)', textAlign: 'center' }}>
          Sign up
        </h1>
        {successMessage ? (
          <>
            <p
              style={{
                color: 'var(--color-success, #22c55e)',
                marginBottom: 24,
                fontSize: 14,
                background: 'var(--success-bg, rgba(34, 197, 94, 0.1))',
                padding: 12,
                borderRadius: 8,
              }}
            >
              {successMessage}
            </p>
            <Link
              to="/login"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-primary, #3b82f6)',
                color: '#fff',
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Go to sign in
            </Link>
          </>
        ) : (
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 8, color: 'var(--color-text-muted, #94a3b8)', fontSize: 14 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: 16,
              borderRadius: 8,
              border: '1px solid var(--color-border, #334155)',
              background: 'var(--color-bg, #0f172a)',
              color: 'var(--color-text, #f1f5f9)',
              boxSizing: 'border-box',
            }}
          />
          <label style={{ display: 'block', marginBottom: 8, color: 'var(--color-text-muted, #94a3b8)', fontSize: 14 }}>
            Password (min {MIN_PASSWORD_LENGTH} characters)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: 16,
              borderRadius: 8,
              border: '1px solid var(--color-border, #334155)',
              background: 'var(--color-bg, #0f172a)',
              color: 'var(--color-text, #f1f5f9)',
              boxSizing: 'border-box',
            }}
          />
          <label style={{ display: 'block', marginBottom: 8, color: 'var(--color-text-muted, #94a3b8)', fontSize: 14 }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: 24,
              borderRadius: 8,
              border: '1px solid var(--color-border, #334155)',
              background: 'var(--color-bg, #0f172a)',
              color: 'var(--color-text, #f1f5f9)',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ color: 'var(--color-error, #f87171)', marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-primary, #3b82f6)',
              color: '#fff',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        )}
        <p style={{ marginTop: 24, color: 'var(--color-text-muted, #94a3b8)', fontSize: 14 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary, #3b82f6)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
