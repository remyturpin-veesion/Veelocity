import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React render/commit errors and shows a fallback UI instead of
 * crashing the tab (e.g. avoiding "Aw, Snap!" / Error code: 5).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: 'var(--color-bg, #0f172a)',
            color: 'var(--color-text, #e2e8f0)',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: 'var(--color-text-muted, #94a3b8)', marginBottom: 24, textAlign: 'center' }}>
            The page encountered an error. You can try reloading or going back to the dashboard.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-primary, #3b82f6)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border, #334155)',
                background: 'transparent',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
