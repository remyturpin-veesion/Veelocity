import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { getSyncCoverage, getDailyCoverage, getSyncStatus, getGreptileRepos } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { PageSummary } from '@/components/PageSummary.js';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import type { DailyCoverageResponse } from '@/types/index.js';

/** Fixed date range for data-coverage: last 90 days. */
function getDataCoverageDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 89); // 90 days including today
  start.setHours(0, 0, 0, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

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

/** Max chart points to avoid heavy render (backend typically returns 90). */
const MAX_CHART_POINTS = 91;

/** Max list items to render (avoids huge DOM and "Aw, Snap!" on data-coverage). */
const MAX_VISIBLE_REPOS = 50;
const MAX_VISIBLE_LINEAR_TEAMS = 50;

function buildChartData(daily: DailyCoverageResponse): Array<{ date: string; name: string; prs: number; issues: number; cursorRequests: number; greptileRepos: number; sentryProjects: number }> {
  const { github, linear, cursor, greptile, sentry } = daily;
  if (!github?.length || !Array.isArray(linear)) return [];
  const len = Math.min(github.length, MAX_CHART_POINTS);
  const result: Array<{ date: string; name: string; prs: number; issues: number; cursorRequests: number; greptileRepos: number; sentryProjects: number }> = [];
  for (let i = 0; i < len; i++) {
    const g = github[i];
    const prs = Number(g?.count) || 0;
    const issues = Number(linear[i]?.count) || 0;
    const cursorRequests = Number(cursor?.[i]?.count) || 0;
    const greptileRepos = Number(greptile?.[i]?.count) || 0;
    const sentryProjects = Number(sentry?.[i]?.count) || 0;
    if (typeof g?.date !== 'string') continue;
    result.push({
      date: g.date,
      name: formatDateLabel(g.date),
      prs: Number.isFinite(prs) ? prs : 0,
      issues: Number.isFinite(issues) ? issues : 0,
      cursorRequests: Number.isFinite(cursorRequests) ? cursorRequests : 0,
      greptileRepos: Number.isFinite(greptileRepos) ? greptileRepos : 0,
      sentryProjects: Number.isFinite(sentryProjects) ? sentryProjects : 0,
    });
  }
  return result;
}

/** Distinct color per connector block. */
const CONNECTOR_ACCENT: Record<string, string> = {
  github: 'var(--metric-github)',
  github_actions: 'var(--metric-green)',
  linear: 'var(--metric-orange)',
  cursor: 'var(--metric-blue)',
  greptile: 'var(--metric-teal)',
  sentry: 'var(--metric-purple, #8b5cf6)',
};

const JOB_LABELS: Record<string, string> = {
  incremental_sync: 'Incremental sync',
  fill_details: 'Filling PR details',
  full_sync: 'Full sync',
  linear_sync: 'Linear sync',
  cursor_sync: 'Cursor sync',
  greptile_sync: 'Greptile sync',
  sentry_sync: 'Sentry sync',
};

export function DataCoverageScreen() {
  const queryClient = useQueryClient();
  useFiltersStore((s) => s.repoIds);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const { startDate, endDate } = getDataCoverageDateRange();
  const repoIds = getRepoIdsForApi();
  const noReposSelected = hasNoReposSelected();

  const syncParams = useMemo(
    () => ({
      repo_ids: noReposSelected ? [] : repoIds ?? undefined,
      start_date: startDate,
      end_date: endDate,
    }),
    [noReposSelected, repoIds, startDate, endDate]
  );

  const { data: syncStatus } = useQuery({
    queryKey: ['sync', 'status', syncParams],
    queryFn: () => getSyncStatus(syncParams),
    refetchInterval: (query) => {
      const inProgress = query.state.data?.sync_in_progress;
      return inProgress ? 5_000 : 15_000;
    },
    refetchOnWindowFocus: true,
  });

  // Poll coverage more often during sync; otherwise every 30s so "Last sync" updates after scheduled jobs
  const coveragePollInterval = syncStatus?.sync_in_progress ? 5_000 : 30_000;
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['sync', 'coverage', syncParams],
    queryFn: () => getSyncCoverage(syncParams),
    refetchInterval: coveragePollInterval,
  });

  // When coverage refetches (e.g. after scheduled Linear sync), refresh sync status so Linear teams progression updates
  const prevCoverageUpdated = useRef(0);
  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== prevCoverageUpdated.current) {
      prevCoverageUpdated.current = dataUpdatedAt;
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] });
    }
  }, [dataUpdatedAt, queryClient]);

  const dailyParams = useMemo(
    () => ({
      start_date: startDate,
      end_date: endDate,
      repo_ids: noReposSelected ? [] : repoIds ?? undefined,
    }),
    [startDate, endDate, noReposSelected, repoIds]
  );
  const { data: dailyData } = useQuery({
    queryKey: ['sync', 'coverage', 'daily', dailyParams],
    queryFn: () => getDailyCoverage(dailyParams),
  });

  const chartData = useMemo(
    () => (dailyData ? buildChartData(dailyData) : []),
    [dailyData]
  );

  const syncInProgress = syncStatus?.sync_in_progress ?? false;
  const currentJob = syncStatus?.current_job ?? null;
  const tasksRemaining = syncStatus?.prs_without_details ?? 0;
  const isFullySynced = (syncStatus?.is_complete ?? false) && !syncInProgress;
  const allRepos = useMemo(() => (syncStatus?.repositories ?? []).slice().sort((a, b) => {
    const pctA = a.total_prs > 0 ? (a.with_details / a.total_prs) : 0;
    const pctB = b.total_prs > 0 ? (b.with_details / b.total_prs) : 0;
    return pctB - pctA;
  }), [syncStatus?.repositories]);
  const allLinearTeams = useMemo(() => syncStatus?.linear_teams ?? [], [syncStatus?.linear_teams]);
  const repos = allRepos.slice(0, MAX_VISIBLE_REPOS);
  const reposOmitted = allRepos.length - repos.length;
  const linearTeams = allLinearTeams.slice(0, MAX_VISIBLE_LINEAR_TEAMS);
  const linearTeamsOmitted = allLinearTeams.length - linearTeams.length;
  const totalLinearIssues = allLinearTeams.reduce((sum, t) => sum + t.total_issues, 0);
  const totalWorkflowRuns = data?.total_workflow_runs ?? 0;
  const cursorConnected = syncStatus?.cursor_connected ?? false;
  const cursorTeamMembersCount = syncStatus?.cursor_team_members_count ?? null;
  const greptileConnected = syncStatus?.greptile_connected ?? false;
  const greptileReposCount = syncStatus?.greptile_repos_count ?? null;

  const { data: greptileReposData, isLoading: greptileReposLoading } = useQuery({
    queryKey: ['greptile', 'repos'],
    queryFn: getGreptileRepos,
    enabled: greptileConnected,
  });
  const greptileProgress = useMemo(() => {
    if (!greptileReposData?.repos) return { indexed: 0, total: 0, pct: 0, byStatus: null };
    const total = greptileReposData.total_github_repos ?? greptileReposData.repos.length;
    const indexed = greptileReposData.repos.filter((r) => r.index_status === 'indexed').length;
    const pct = total > 0 ? Math.round((indexed / total) * 100) : 0;
    const byStatus = {
      indexed,
      notIndexed: greptileReposData.repos.filter((r) => r.index_status === 'not_indexed').length,
      processing: greptileReposData.repos.filter((r) => r.index_status === 'processing').length,
      stale: greptileReposData.repos.filter((r) => r.index_status === 'stale').length,
      error: greptileReposData.repos.filter((r) => r.index_status === 'error').length,
      active: greptileReposData.repos.filter((r) => r.index_status === 'active').length,
    };
    return { indexed, total, pct, byStatus };
  }, [greptileReposData]);

  /** Overall progression % per connector for the accordion header (same logic as inner rows). */
  const connectorPct = useMemo(() => {
    const out: Record<string, number> = {};
    // GitHub: share of PRs with details across all repos (0% when no PRs yet)
    const totalPrs = allRepos.reduce((s, r) => s + r.total_prs, 0);
    const withDetails = allRepos.reduce((s, r) => s + r.with_details, 0);
    out.github = totalPrs > 0 ? Math.round((withDetails / totalPrs) * 100) : 0;
    // GitHub Actions: 100% if we have any workflow runs
    out.github_actions = totalWorkflowRuns > 0 ? 100 : 0;
    // Linear: share of teams that have issues synced
    const teamsWithIssues = allLinearTeams.filter((t) => t.total_issues > 0).length;
    out.linear = allLinearTeams.length > 0 ? Math.round((teamsWithIssues / allLinearTeams.length) * 100) : 0;
    out.cursor = cursorConnected ? 100 : 0;
    // Greptile: share of GitHub repos that are indexed (when data available; else 100% when connected)
    out.greptile = greptileConnected
      ? (greptileReposData ? greptileProgress.pct : 100)
      : 0;
    // Sentry: 100% if last sync ran, else 0%
    const sentryConnector = data?.connectors?.find((c) => c.connector_name === 'sentry');
    out.sentry = sentryConnector?.last_sync_at ? 100 : 0;
    return out;
  }, [allRepos, allLinearTeams, totalWorkflowRuns, cursorConnected, greptileConnected, greptileReposData, greptileProgress.pct, data?.connectors]);

  if (isLoading) return <div className="loading">Loading coverage…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  return (
    <div className="data-coverage">
      <header className="data-coverage__header">
        <h1 className="screen-title">Data coverage</h1>
        <PageSummary>
          Sync and data coverage across GitHub, Actions, Linear, Cursor, Greptile, Sentry · Last 90 days (fixed)
        </PageSummary>
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
            GitHub PR details fully synced — {syncStatus.prs_with_details.toLocaleString()} PR{syncStatus.prs_with_details === 1 ? '' : 's'}.
            {allLinearTeams.length > 0 && (
              <> Linear: {totalLinearIssues.toLocaleString()} issue{totalLinearIssues === 1 ? '' : 's'} across {allLinearTeams.length} team{allLinearTeams.length === 1 ? '' : 's'}.</>
            )}
            {totalWorkflowRuns > 0 && (
              <> GitHub Actions: {totalWorkflowRuns.toLocaleString()} workflow run{totalWorkflowRuns === 1 ? '' : 's'}.</>
            )}
            {allLinearTeams.length === 0 && totalWorkflowRuns === 0 && (
              <> Connector status in Connectors below.</>
            )}
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
        <h2 className="data-coverage__section-title">Connectors (GitHub, GitHub Actions, Linear, Cursor, Greptile, Sentry)</h2>
        <div className="card data-coverage__connectors-card">
          {data?.connectors?.length ? (
            <div className="data-coverage__accordion">
              {data.connectors.map((c) => (
                <details
                  key={c.connector_name}
                  className="data-coverage__accordion-item"
                  style={{ '--connector-accent': CONNECTOR_ACCENT[c.connector_name] ?? 'var(--primary)' } as React.CSSProperties}
                >
                  <summary className="data-coverage__accordion-summary">
                    <span className="data-coverage__connector-dot" />
                    <div className="data-coverage__connector-info">
                      <span className="data-coverage__connector-name">
                        {c.display_name ?? c.connector_name.replace(/_/g, ' ')}
                      </span>
                      <span className="data-coverage__connector-sync">
                        Last sync: {formatLastSync(c.last_sync_at)}
                      </span>
                    </div>
                    <span className="data-coverage__connector-pct" aria-label={`${connectorPct[c.connector_name] ?? 0}% overall`}>
                      {connectorPct[c.connector_name] ?? 0}%
                    </span>
                    <span className="data-coverage__accordion-chevron" aria-hidden />
                  </summary>
                  <div className="data-coverage__accordion-body">
                  {c.connector_name === 'github' && allRepos.length > 0 && (
                    <div className="data-coverage__repos-inline">
                      <h3 className="data-coverage__subsection-title">GitHub repos progression update</h3>
                      <p className="data-coverage__repos-desc">
                        PR detail sync (reviews, comments, commits) per repo.
                      </p>
                      <ul className="data-coverage__repo-list">
                        {repos.map((r) => {
                          const pct = r.total_prs > 0 ? Math.round((r.with_details / r.total_prs) * 100) : 0;
                          const isRepoComplete = r.total_prs > 0 && r.without_details === 0;
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
                      {reposOmitted > 0 && (
                        <p className="data-coverage__repos-desc" style={{ marginTop: 8 }}>
                          … and {reposOmitted.toLocaleString()} more repo{reposOmitted === 1 ? '' : 's'} (list capped for performance).
                        </p>
                      )}
                    </div>
                  )}
                  {c.connector_name === 'linear' && allLinearTeams.length > 0 && (
                    <div className="data-coverage__repos-inline">
                      <h3 className="data-coverage__subsection-title">Linear teams progression</h3>
                      <p className="data-coverage__repos-desc">
                        Issues synced per team.
                      </p>
                      <ul className="data-coverage__repo-list">
                        {linearTeams.map((t) => {
                          const synced = t.total_issues > 0;
                          return (
                            <li
                              key={t.key}
                              className={`data-coverage__repo-row ${synced ? 'data-coverage__repo-row--complete' : ''}`}
                              style={{ '--repo-pct': synced ? '100%' : '0%' } as React.CSSProperties}
                            >
                              <span className="data-coverage__repo-row-fill" aria-hidden />
                              <span className="data-coverage__repo-name" title={t.name}>
                                {t.name}
                              </span>
                              <span className="data-coverage__repo-counts">
                                {t.total_issues.toLocaleString()} issue{t.total_issues === 1 ? '' : 's'}
                              </span>
                              <span className="data-coverage__repo-pct" aria-label={synced ? '100% synced' : '0%'}>
                                {synced ? '100%' : '0%'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {linearTeamsOmitted > 0 && (
                        <p className="data-coverage__repos-desc" style={{ marginTop: 8 }}>
                          … and {linearTeamsOmitted.toLocaleString()} more team{linearTeamsOmitted === 1 ? '' : 's'} (list capped for performance).
                        </p>
                      )}
                    </div>
                  )}
                  {c.connector_name === 'cursor' && (
                    <div className="data-coverage__repos-inline">
                      <h3 className="data-coverage__subsection-title">Cursor progression</h3>
                      <p className="data-coverage__repos-desc">
                        Team, spend, and usage synced to DB (hourly); overview reads from stored data.
                      </p>
                      <ul className="data-coverage__repo-list">
                        <li
                          className={`data-coverage__repo-row ${cursorConnected ? 'data-coverage__repo-row--complete' : ''}`}
                          style={{ '--repo-pct': cursorConnected ? '100%' : '0%' } as React.CSSProperties}
                        >
                          <span className="data-coverage__repo-row-fill" aria-hidden />
                          <span className="data-coverage__repo-name" title="Cursor API">
                            Cursor API
                          </span>
                          <span className="data-coverage__repo-counts">
                            {cursorConnected
                              ? cursorTeamMembersCount != null
                                ? `${cursorTeamMembersCount.toLocaleString()} team member${cursorTeamMembersCount === 1 ? '' : 's'}`
                                : 'Connected'
                              : 'Not configured'}
                          </span>
                          <span className="data-coverage__repo-pct" aria-label={cursorConnected ? '100% connected' : '0%'}>
                            {cursorConnected ? '100%' : '0%'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  )}
                  {c.connector_name === 'greptile' && (
                    <div className="data-coverage__repos-inline">
                      <h3 className="data-coverage__subsection-title">Greptile progression</h3>
                      <p className="data-coverage__repos-desc">
                        Repositories indexed in Greptile for AI code review. Sync from Greptile to DB runs periodically.
                      </p>
                      <ul className="data-coverage__repo-list">
                        <li
                          className={`data-coverage__repo-row ${greptileProgress.pct === 100 && greptileConnected ? 'data-coverage__repo-row--complete' : ''}`}
                          style={{ '--repo-pct': `${greptileProgress.pct}%` } as React.CSSProperties}
                        >
                          <span className="data-coverage__repo-row-fill" aria-hidden />
                          <span className="data-coverage__repo-name" title="Indexing progress">
                            Indexing progress
                          </span>
                          <span className="data-coverage__repo-counts">
                            {greptileConnected ? (
                              greptileReposLoading && !greptileReposData ? (
                                'Loading…'
                              ) : greptileReposData ? (
                                <>
                                  {greptileProgress.indexed.toLocaleString()} indexed / {greptileProgress.total.toLocaleString()} GitHub repos
                                  {greptileProgress.byStatus && (
                                    <span className="data-coverage__greptile-breakdown" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                      {' '}
                                      ({[
                                        greptileProgress.byStatus.indexed > 0 && `${greptileProgress.byStatus.indexed} indexed`,
                                        greptileProgress.byStatus.active > 0 && `${greptileProgress.byStatus.active} active`,
                                        greptileProgress.byStatus.processing > 0 && `${greptileProgress.byStatus.processing} processing`,
                                        greptileProgress.byStatus.notIndexed > 0 && `${greptileProgress.byStatus.notIndexed} not indexed`,
                                        greptileProgress.byStatus.stale > 0 && `${greptileProgress.byStatus.stale} stale`,
                                        greptileProgress.byStatus.error > 0 && `${greptileProgress.byStatus.error} error`,
                                      ].filter(Boolean).join(', ')})
                                    </span>
                                  )}
                                </>
                              ) : (
                                greptileReposCount != null
                                  ? `${greptileReposCount.toLocaleString()} repo${greptileReposCount === 1 ? '' : 's'} in Greptile`
                                  : 'Connected'
                              )
                            ) : (
                              'Not configured'
                            )}
                          </span>
                          <span className="data-coverage__repo-pct" aria-label={`${greptileProgress.pct}% indexed`}>
                            {greptileConnected ? `${greptileProgress.pct}%` : '0%'}
                          </span>
                        </li>
                      </ul>
                      {greptileConnected && (
                        <p className="data-coverage__repos-desc" style={{ marginTop: 8 }}>
                          <Link to="/greptile/indexing" style={{ color: 'var(--link)', fontWeight: 500 }}>
                            Manage indexing →
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                  {c.connector_name === 'sentry' && (
                    <div className="data-coverage__repos-inline">
                      <h3 className="data-coverage__subsection-title">Sentry progression</h3>
                      <p className="data-coverage__repos-desc">
                        Projects, event counts (24h/7d), and unresolved issues synced from your Sentry organization (Production environment only). Configure API token and org in Settings. Sync runs every 5 min.
                      </p>
                      <p className="data-coverage__repos-desc" style={{ marginTop: 8 }}>
                        <Link to="/sentry" style={{ color: 'var(--link)', fontWeight: 500 }}>
                          View Sentry overview →
                        </Link>
                      </p>
                    </div>
                  )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="empty-state">No connector state.</div>
          )}
        </div>
      </section>

      {chartData.length > 0 && (
        <section className="data-coverage__chart">
          <h2 className="data-coverage__section-title">
            Sync progression ({formatDateRangeDisplay(startDate, endDate)})
          </h2>
          <div className="card data-coverage__chart-card">
            <p className="data-coverage__chart-desc">
              Data synced per day: PRs created, Linear issues, Cursor AI requests, Greptile repos, and Sentry projects.
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
                  dataKey="issues"
                  name="Linear issues"
                  stroke="var(--metric-orange)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="cursorRequests"
                  name="Cursor (synced)"
                  stroke="var(--metric-blue)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="greptileRepos"
                  name="Greptile (synced)"
                  stroke="var(--metric-teal)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="sentryProjects"
                  name="Sentry (synced)"
                  stroke="var(--metric-purple, #8b5cf6)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <footer className="sentry-overview__filters-footer" style={{ marginTop: 24 }}>
        <span className="sentry-overview__filters-label">Active filters:</span>
        <span className="sentry-overview__filters-value">
          {formatDateRangeDisplay(startDate, endDate)}
          {noReposSelected ? ' · No repos selected' : repoIds && repoIds.length > 0 ? ` · ${repoIds.length} repo(s) selected` : ' · All repos'}
        </span>
      </footer>
    </div>
  );
}
