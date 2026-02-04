import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getSyncCoverage, getDailyCoverage, getSyncStatus } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import type { DailyCoverageResponse } from '@/types/index.js';

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatLastSync(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return `Yesterday at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildChartData(daily: DailyCoverageResponse) {
  const { github, github_actions, linear } = daily;
  if (!github?.length || !github_actions?.length || !linear?.length) return [];
  return github.map((g, i) => ({
    date: g.date,
    name: formatDateLabel(g.date),
    prs: g.count,
    workflowRuns: github_actions[i]?.count ?? 0,
    issues: linear[i]?.count ?? 0,
  }));
}

const CONNECTOR_ACCENT: Record<string, string> = {
  github: 'var(--primary)',
  github_actions: 'var(--metric-green)',
  linear: 'var(--metric-orange)',
};

const JOB_LABELS: Record<string, string> = {
  incremental_sync: 'Incremental sync',
  fill_details: 'Filling PR details',
  full_sync: 'Full sync',
};

export function DataCoverageScreen() {
  const { data: syncStatus } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => getSyncStatus(),
    refetchInterval: (query) => {
      const inProgress = query.state.data?.sync_in_progress;
      return inProgress ? 2_000 : 15_000;
    },
  });

  const pollInterval = syncStatus?.sync_in_progress ? 5_000 : undefined;
  const { data, isLoading, error } = useQuery({
    queryKey: ['sync', 'coverage'],
    queryFn: () => getSyncCoverage(),
    refetchInterval: pollInterval,
  });

  const { data: dailyData } = useQuery({
    queryKey: ['sync', 'coverage', 'daily', 90],
    queryFn: () => getDailyCoverage(90),
  });

  const chartData = useMemo(
    () => (dailyData ? buildChartData(dailyData) : []),
    [dailyData]
  );

  if (isLoading) return <div className="loading">Loading coverage…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const syncInProgress = syncStatus?.sync_in_progress ?? false;
  const currentJob = syncStatus?.current_job ?? null;
  const tasksRemaining = syncStatus?.prs_without_details ?? 0;
  const isFullySynced = (syncStatus?.is_complete ?? false) && !syncInProgress;
  const repos = syncStatus?.repositories ?? [];

  return (
    <div className="data-coverage">
      <header className="data-coverage__header">
        <h1 className="screen-title">Data coverage</h1>
        <p className="data-coverage__subtitle">
          Synced data from GitHub, GitHub Actions, and Linear. Trigger sync from Settings or the connector pages.
        </p>
      </header>

      {syncInProgress && (
        <div className="data-coverage__sync-banner" role="status" aria-live="polite">
          <span className="data-coverage__sync-banner-dot" aria-hidden />
          <span className="data-coverage__sync-banner-text">
            {currentJob ? JOB_LABELS[currentJob] ?? currentJob : 'Sync'} in progress
            {tasksRemaining > 0 && (
              <> — {tasksRemaining.toLocaleString()} PR{tasksRemaining === 1 ? '' : 's'} remaining for details</>
            )}
          </span>
        </div>
      )}

      {!syncInProgress && isFullySynced && syncStatus && syncStatus.total_prs > 0 && (
        <div className="data-coverage__sync-banner data-coverage__sync-banner--complete" role="status">
          <span className="data-coverage__sync-banner-check" aria-hidden>✓</span>
          <span className="data-coverage__sync-banner-text">
            GitHub PR details fully synced — {syncStatus.prs_with_details.toLocaleString()} PR{syncStatus.prs_with_details === 1 ? '' : 's'}. Linear and GitHub Actions status in Connectors below.
          </span>
        </div>
      )}

      {!syncInProgress && !isFullySynced && tasksRemaining > 0 && (
        <div className="data-coverage__sync-banner data-coverage__sync-banner--pending" role="status">
          <span className="data-coverage__sync-banner-dot data-coverage__sync-banner-dot--pending" aria-hidden />
          <span className="data-coverage__sync-banner-text">
            {tasksRemaining.toLocaleString()} PR{tasksRemaining === 1 ? '' : 's'} still need details (reviews, comments, commits). Filled in the background every 10 min.
          </span>
        </div>
      )}

      <section className="data-coverage__totals">
        <h2 className="data-coverage__section-title">Totals</h2>
        <div className="data-coverage__kpi-row">
          <KpiCard
            title="Pull requests"
            value={(data?.total_pull_requests ?? 0).toLocaleString()}
            accent="primary"
          />
          <KpiCard
            title="Commits"
            value={(data?.total_commits ?? 0).toLocaleString()}
            accent="purple"
          />
          <KpiCard
            title="Workflow runs"
            value={(data?.total_workflow_runs ?? 0).toLocaleString()}
            accent="green"
          />
          <KpiCard
            title="Developers"
            value={(data?.total_developers ?? 0).toLocaleString()}
            accent="orange"
          />
        </div>
      </section>

      <section className="data-coverage__connectors">
        <h2 className="data-coverage__section-title">Connectors (GitHub, GitHub Actions, Linear)</h2>
        <div className="card data-coverage__connectors-card">
          {data?.connectors?.length ? (
            <ul className="data-coverage__connector-list">
              {data.connectors.map((c) => (
                <li
                  key={c.connector_name}
                  className={c.connector_name === 'github' && repos.length > 0 ? 'data-coverage__connector-item data-coverage__connector-item--with-repos' : 'data-coverage__connector-item'}
                >
                  <div
                    className="data-coverage__connector-row"
                    style={{ '--connector-accent': CONNECTOR_ACCENT[c.connector_name] ?? 'var(--primary)' } as React.CSSProperties}
                  >
                    <span className="data-coverage__connector-dot" />
                    <div className="data-coverage__connector-info">
                      <span className="data-coverage__connector-name">
                        {c.display_name ?? c.connector_name.replace(/_/g, ' ')}
                      </span>
                      <span className="data-coverage__connector-sync">
                        Last sync: {formatLastSync(c.last_sync_at)}
                      </span>
                    </div>
                  </div>
                  {c.connector_name === 'github' && repos.length > 0 && (
                    <div className="data-coverage__repos-inline">
                      <h3 className="data-coverage__subsection-title">GitHub repos progression update</h3>
                      <p className="data-coverage__repos-desc">
                        PR detail sync (reviews, comments, commits) per repo.
                      </p>
                      <ul className="data-coverage__repo-list">
                        {repos.map((r) => {
                          const pct = r.total_prs > 0 ? Math.round((r.with_details / r.total_prs) * 100) : 100;
                          const isRepoComplete = r.without_details === 0;
                          return (
                            <li
                              key={r.name}
                              className={`data-coverage__repo-row ${isRepoComplete ? 'data-coverage__repo-row--complete' : ''}`}
                              style={{ '--repo-pct': `${pct}%` } as React.CSSProperties}
                            >
                              <span className="data-coverage__repo-row-fill" aria-hidden />
                              <span className="data-coverage__repo-name" title={r.name}>
                                {r.name}
                              </span>
                              <span className="data-coverage__repo-counts">
                                {r.with_details.toLocaleString()} / {r.total_prs.toLocaleString()} PRs
                              </span>
                              <span className="data-coverage__repo-pct" aria-label={`${pct}% synced`}>
                                {pct}%
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No connector state.</div>
          )}
        </div>
      </section>

      {chartData.length > 0 && (
        <section className="data-coverage__chart">
          <h2 className="data-coverage__section-title">Sync progression (last 90 days)</h2>
          <div className="card data-coverage__chart-card">
            <p className="data-coverage__chart-desc">
              Data synced per day: PRs created, workflow runs, and Linear issues.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                  }}
                  labelStyle={{ color: 'var(--text)' }}
                  labelFormatter={(label) => label}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="prs"
                  name="PRs (GitHub)"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="workflowRuns"
                  name="Workflow runs"
                  stroke="var(--metric-green)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="issues"
                  name="Linear issues"
                  stroke="var(--metric-orange)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
