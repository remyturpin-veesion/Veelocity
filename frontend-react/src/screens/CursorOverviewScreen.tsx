import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCursorOverview, getSettings } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';

export function CursorOverviewScreen() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['cursor', 'overview'],
    queryFn: getCursorOverview,
    enabled: settings?.cursor_configured === true,
  });

  if (settings?.cursor_configured !== true) {
    return (
      <div>
        <h1 className="screen-title">Cursor</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Team usage and spend from your Cursor workspace
        </p>
        <EmptyState
          title="Cursor not connected"
          message="Add your Cursor API key in Settings to see team size, daily active users, and spend here. Create a key in Cursor Dashboard → Settings → Advanced → Admin API Keys."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) return <div className="loading">Loading Cursor overview…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const teamCount = data?.team_members_count ?? 0;
  const spendCents = data?.spend_cents ?? 0;
  const spendDollars = (spendCents / 100).toFixed(2);
  const dau = data?.dau;
  const lastDau = dau && dau.length > 0 ? dau[dau.length - 1] : null;
  const dauValue = lastDau?.dau ?? null;

  return (
    <div>
      <h1 className="screen-title">Cursor</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Team usage and spend from your Cursor workspace (Admin &amp; Analytics API)
      </p>

      <div className="dashboard__kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard
          title="Team members"
          value={String(teamCount)}
          subtitle="in Cursor team"
          icon="👥"
        />
        <KpiCard
          title="Current cycle spend"
          value={data?.spend_cents != null ? `$${spendDollars}` : '—'}
          subtitle={data?.spend_members != null ? `${data.spend_members} members` : undefined}
          icon="💰"
        />
        <KpiCard
          title="Daily active users (7d)"
          value={dauValue != null ? String(dauValue) : '—'}
          subtitle={data?.dau_period ? `${data.dau_period.start} – ${data.dau_period.end}` : 'Enterprise only'}
          icon="📊"
        />
      </div>

      {dau && dau.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="dashboard-section-title">Daily active users</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {dau.slice(-14).reverse().map((d: { date: string; dau: number }) => (
              <li key={d.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <span>{d.date}</span>
                <span>{d.dau} users</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.usage_summary && data.usage_summary.length > 0 && (
        <div className="card">
          <h3 className="dashboard-section-title">Recent usage (last 7 days)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Aggregated daily usage from Cursor Admin API (lines added/removed, composer/chat/agent requests).
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {data.usage_summary.length} day(s) of data. For full breakdown, use the Cursor Dashboard.
          </p>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Link to="/" style={{ color: 'var(--link)' }}>Dashboard</Link> includes a Cursor summary block when connected.
      </p>
    </div>
  );
}
