import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getGreptileOverview, getSettings } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import type { GreptileRepoInfo } from '@/types/index.js';

const STATUS_COLORS: Record<string, string> = {
  success: 'var(--metric-green)',
  completed: 'var(--metric-green)',
  indexed: 'var(--metric-green)',
  processing: 'var(--metric-blue)',
  pending: 'var(--text-muted)',
  failed: 'var(--metric-orange)',
  error: 'var(--metric-orange)',
};

function getStatusColor(status: string): string {
  const key = (status || 'unknown').toLowerCase();
  return STATUS_COLORS[key] ?? 'var(--primary)';
}

export function GreptileOverviewScreen() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['greptile', 'overview'],
    queryFn: getGreptileOverview,
    enabled: settings?.greptile_configured === true,
  });

  const repos = data?.repositories ?? [];
  const byStatus = data?.repos_by_status ?? {};
  const byRemote = data?.repos_by_remote ?? {};
  const statusChartData = useMemo(
    () => Object.entries(byStatus).map(([status, count]) => ({ status: status || 'unknown', count })),
    [byStatus]
  );

  if (settings?.greptile_configured !== true) {
    return (
      <div>
        <h1 className="screen-title">Greptile</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Indexed repositories and codebase metrics from Greptile
        </p>
        <EmptyState
          title="Greptile not connected"
          message="Add your Greptile API key in Settings to see indexed repos and status here. Get a key at app.greptile.com/api."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) return <div className="loading">Loading Greptile overview…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const reposCount = data?.repos_count ?? 0;
  const totalFiles = data?.total_files_processed ?? 0;
  const totalNumFiles = data?.total_num_files ?? 0;
  const progressPct = data?.indexing_complete_pct ?? null;
  const remoteSummary =
    Object.keys(byRemote).length > 0
      ? Object.entries(byRemote)
          .map(([r, c]) => `${r}: ${c}`)
          .join(' · ')
      : '—';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <h1 className="screen-title">Greptile</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.9375rem' }}>
        Indexing status and file counts from the Greptile API.{' '}
        <a href="https://app.greptile.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>
          Open Greptile app
        </a>
      </p>

      {/* KPIs — clear and minimal */}
      <div className="dashboard__kpi-row" style={{ marginBottom: 32 }}>
        <KpiCard
          title="Indexed repos"
          value={String(reposCount)}
          subtitle={reposCount === 1 ? 'repository' : 'repositories'}
          icon="📚"
        />
        <KpiCard
          title="Files indexed"
          value={totalFiles > 0 ? totalFiles.toLocaleString() : '—'}
          subtitle={totalNumFiles > 0 ? `of ${totalNumFiles.toLocaleString()} total` : undefined}
          icon="📄"
        />
        <KpiCard
          title="Indexing progress"
          value={progressPct != null ? `${progressPct}%` : '—'}
          subtitle="overall"
          icon="✓"
        />
        <KpiCard
          title="By source"
          value={remoteSummary}
          subtitle="repos per remote"
          icon="🔗"
        />
      </div>

      {/* Single clear chart: status breakdown */}
      {statusChartData.length > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, marginTop: 0, color: 'var(--text)' }}>
            Repositories by status
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                labelStyle={{ color: 'var(--text)' }}
              />
              <Bar dataKey="count" name="Repos" radius={[4, 4, 0, 0]}>
                {statusChartData.map((entry, index) => (
                  <Cell key={index} fill={getStatusColor(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Compact repo table */}
      {repos.length > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, marginTop: 0, color: 'var(--text)' }}>
            Repositories
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Repository</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Branch</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Files</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r: GreptileRepoInfo, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '10px 12px' }}>{r.repository}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.branch || '—'}</td>
                    <td style={{ padding: '10px 12px', color: getStatusColor(r.status) }}>{r.status || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.files_processed != null && r.num_files != null
                        ? `${r.files_processed.toLocaleString()} / ${r.num_files.toLocaleString()}`
                        : r.files_processed != null
                          ? r.files_processed.toLocaleString()
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reposCount === 0 && data && (
        <div className="card" style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No repositories indexed yet. Index repos via the Greptile API or app; if you have GitHub repos configured in Veelocity, we check their Greptile status when you open this page.
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Link to="/" style={{ color: 'var(--link)' }}>Dashboard</Link> shows a Greptile overview with a full per-repo chart.
      </p>
    </div>
  );
}
