import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.js';
import { login } from '@/api/endpoints.js';

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => Boolean(s.token));
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      setAuth(data.access_token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      try {
        const body = JSON.parse(msg);
        setError(body.detail ?? msg);
      } catch {
        setError(msg);
      }
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
          Sign in
        </h1>
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
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ marginTop: 24, color: 'var(--color-text-muted, #94a3b8)', fontSize: 14 }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--color-primary, #3b82f6)' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
