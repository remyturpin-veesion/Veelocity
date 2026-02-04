import { useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import {
  getDeploymentFrequency,
  getLeadTime,
  getCycleTime,
  getDeploymentReliability,
  getLeadTimeByPeriod,
  getCycleTimeByPeriod,
  getAlerts,
  getReviewerWorkload,
  getSettings,
  getCursorOverview,
} from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { GlobalFlowChart, type GlobalFlowDataPoint } from '@/components/GlobalFlowChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import type { TrendData } from '@/types/index.js';

function formatLeadOrCycleHours(hours: number): string {
  if (hours >= 24) {
    const days = hours / 24;
    return `${days.toFixed(1)} days`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

export function DashboardScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const repoIds = getRepoIdsForApi();
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const deploymentFreq = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoIds],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        period: 'day',
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const leadTime = useQuery({
    queryKey: ['metrics', 'lead-time', startDate, endDate, repoIds],
    queryFn: () =>
      getLeadTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const cycleTime = useQuery({
    queryKey: ['metrics', 'cycle-time', startDate, endDate, repoIds],
    queryFn: () =>
      getCycleTime({
        start_date: startDate,
        end_date: endDate,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const deploymentReliability = useQuery({
    queryKey: ['metrics', 'deployment-reliability', startDate, endDate, repoIds],
    queryFn: () =>
      getDeploymentReliability({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });

  const deploymentFreqChart = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoIds, 'day'],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        period: 'day',
      }),
    enabled: !noReposSelected,
  });
  const leadTimeByPeriod = useQuery({
    queryKey: ['metrics', 'lead-time-by-period', startDate, endDate, repoIds],
    queryFn: () =>
      getLeadTimeByPeriod({
        start_date: startDate,
        end_date: endDate,
        period: 'day',
        repo_ids: repoIds ?? undefined,
      }),
    enabled: !noReposSelected,
  });
  const cycleTimeByPeriod = useQuery({
    queryKey: ['metrics', 'cycle-time-by-period', startDate, endDate, repoIds],
    queryFn: () =>
      getCycleTimeByPeriod({
        start_date: startDate,
        end_date: endDate,
        period: 'day',
      }),
    enabled: !noReposSelected,
  });

  const alerts = useQuery({
    queryKey: ['alerts', startDate, endDate, repoIds],
    queryFn: () => getAlerts({ start_date: startDate, end_date: endDate, repo_ids: repoIds ?? undefined }),
    enabled: !noReposSelected,
  });
  const reviewerWorkload = useQuery({
    queryKey: ['metrics', 'reviewer-workload', startDate, endDate, repoIds],
    queryFn: () =>
      getReviewerWorkload({ start_date: startDate, end_date: endDate, repo_ids: repoIds ?? undefined }),
    enabled: !noReposSelected,
  });

  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const cursorOverview = useQuery({
    queryKey: ['cursor', 'overview'],
    queryFn: getCursorOverview,
    enabled: settings.data?.cursor_configured === true,
  });

  const isLoading =
    !noReposSelected &&
    (deploymentFreq.isLoading ||
      leadTime.isLoading ||
      cycleTime.isLoading ||
      deploymentReliability.isLoading);
  const hasError =
    deploymentFreq.error || leadTime.error || cycleTime.error || deploymentReliability.error;

  const depFreqData = deploymentFreq.data as {
    average?: number;
    total?: number;
    trend?: TrendData;
  } | undefined;
  const leadTimeData = leadTime.data as { average_hours?: number; count?: number; trend?: TrendData } | undefined;
  const cycleTimeData = cycleTime.data as { average_hours?: number; count?: number; trend?: TrendData } | undefined;
  const relData = deploymentReliability.data as {
    failure_rate?: number;
    mttr_hours?: number | null;
    failed_runs?: number;
    trend?: TrendData;
  } | undefined;

  const fluxChartData = useMemo((): GlobalFlowDataPoint[] => {
    const depData = deploymentFreqChart.data as { data?: { period: string; count: number }[] } | undefined;
    const leadByPeriod = leadTimeByPeriod.data ?? [];
    const cycleByPeriod = cycleTimeByPeriod.data ?? [];
    const periodSet = new Set<string>();
    (depData?.data ?? []).forEach((d) => periodSet.add(d.period));
    leadByPeriod.forEach((d) => periodSet.add(d.period));
    cycleByPeriod.forEach((d) => periodSet.add(d.period));
    const periods = Array.from(periodSet).sort();
    const leadMap = new Map(leadByPeriod.map((d) => [d.period, d.median_hours]));
    const cycleMap = new Map(cycleByPeriod.map((d) => [d.period, d.median_hours]));
    const depMap = new Map(
      (depData?.data ?? []).map((d) => [d.period, d.count])
    );
    return periods.map((period) => ({
      period,
      leadTimeHours: leadMap.get(period),
      cycleTimeHours: cycleMap.get(period),
      deployments: depMap.get(period),
    }));
  }, [deploymentFreqChart.data, leadTimeByPeriod.data, cycleTimeByPeriod.data]);

  const comparisonRows = useMemo(() => {
    const rows: { metric: string; current: string; previous: string; trend?: TrendData }[] = [];
    if (depFreqData?.trend)
      rows.push({
        metric: 'Deployment frequency',
        current: (depFreqData.average ?? 0).toFixed(1) + '/day',
        previous: (depFreqData.trend.previous_value ?? 0).toFixed(1) + '/day',
        trend: depFreqData.trend,
      });
    if (leadTimeData?.trend)
      rows.push({
        metric: 'Lead time',
        current: formatLeadOrCycleHours(leadTimeData.average_hours ?? 0),
        previous: formatLeadOrCycleHours(leadTimeData.trend.previous_value ?? 0),
        trend: leadTimeData.trend,
      });
    if (cycleTimeData?.trend)
      rows.push({
        metric: 'Cycle time',
        current: formatLeadOrCycleHours(cycleTimeData.average_hours ?? 0),
        previous: formatLeadOrCycleHours(cycleTimeData.trend.previous_value ?? 0),
        trend: cycleTimeData.trend,
      });
    if (relData?.trend)
      rows.push({
        metric: 'Change failure rate',
        current: (relData.failure_rate ?? 0).toFixed(1) + '%',
        previous: (relData.trend.previous_value ?? 0).toFixed(1) + '%',
        trend: relData.trend,
      });
    return rows;
  }, [depFreqData, leadTimeData, cycleTimeData, relData]);

  const cursor = cursorOverview.data;
  const cursorUsageChartData = useMemo(() => {
    const byDay = cursor?.usage_by_day;
    if (!byDay?.length) return [];
    return byDay.map((d) => ({
      date: d.date,
      lines_added: d.lines_added,
      lines_deleted: d.lines_deleted,
      composer: d.composer_requests,
      chat: d.chat_requests,
      agent: d.agent_requests,
      tabs_accepted: d.tabs_accepted,
    }));
  }, [cursor?.usage_by_day]);

  const tot = cursor?.usage_totals;
  const cursorSummaryBlock =
    settings.data?.cursor_configured && cursor ? (
      <div className="card">
        <h3 className="dashboard-section-title">
          <Link to="/cursor" style={{ color: 'var(--text)', textDecoration: 'none' }}>Cursor</Link>
        </h3>
        <div className="dashboard-quick-overview__row">
          <span style={{ color: 'var(--text-muted)' }}>Team members</span>
          <span>{cursor.team_members_count}</span>
        </div>
        <div className="dashboard-quick-overview__row">
          <span style={{ color: 'var(--text-muted)' }}>Current cycle spend</span>
          <span>
            {cursor.spend_cents != null ? `$${(cursor.spend_cents / 100).toFixed(2)}` : '—'}
          </span>
        </div>
        {tot && (
          <>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Lines added (7d)</span>
              <span>{tot.lines_added.toLocaleString()}</span>
            </div>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Composer requests (7d)</span>
              <span>{tot.composer_requests.toLocaleString()}</span>
            </div>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Chat requests (7d)</span>
              <span>{tot.chat_requests.toLocaleString()}</span>
            </div>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Tabs accepted (7d)</span>
              <span>{tot.tabs_accepted.toLocaleString()}</span>
            </div>
          </>
        )}
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: '0.8125rem' }}>
          <Link to="/cursor" style={{ color: 'var(--link)' }}>View Cursor overview →</Link>
        </p>
      </div>
    ) : null;

  if (noReposSelected) {
    return (
      <div>
        <h1 className="screen-title">Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {startDate} – {endDate}
        </p>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see dashboard data."
        />
      </div>
    );
  }

  if (isLoading && !depFreqData) {
    return (
      <div>
        <h1 className="screen-title">Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {startDate} – {endDate}
        </p>
        <div className="dashboard__kpi-row">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div>
        <h1 className="screen-title">Dashboard</h1>
        <EmptyState
          title="Unable to load metrics"
          message="Make sure the backend is running and try again."
          actionLabel="Retry"
          onAction={() => {
            deploymentFreq.refetch();
            leadTime.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="screen-title">Dashboard</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate}
      </p>
      <div className="dashboard">
        <div className="dashboard__kpi-row">
          <KpiCard
            title="Lead time"
            value={
              leadTimeData?.average_hours != null
                ? formatLeadOrCycleHours(leadTimeData.average_hours)
                : '—'
            }
            subtitle={leadTimeData?.count != null ? `${leadTimeData.count} changes` : undefined}
            to="/metrics/lead-time"
            icon="⏱"
            trend={
              leadTimeData?.trend
                ? {
                    change_percent: leadTimeData.trend.change_percent,
                    is_improving: leadTimeData.trend.is_improving,
                  }
                : undefined
            }
          />
          <KpiCard
            title="Cycle time"
            value={
              cycleTimeData?.average_hours != null
                ? formatLeadOrCycleHours(cycleTimeData.average_hours)
                : '—'
            }
            subtitle={cycleTimeData?.count != null ? `${cycleTimeData.count} completed` : undefined}
            to="/metrics/cycle-time"
            icon="🔄"
            trend={
              cycleTimeData?.trend
                ? {
                    change_percent: cycleTimeData.trend.change_percent,
                    is_improving: cycleTimeData.trend.is_improving,
                  }
                : undefined
            }
          />
          <KpiCard
            title="Deployment frequency"
            value={
              depFreqData?.average != null
                ? `${depFreqData.average.toFixed(1)} /day`
                : '—'
            }
            subtitle="avg in period"
            to="/metrics/deployment-frequency"
            icon="🚀"
            trend={
              depFreqData?.trend
                ? {
                    change_percent: depFreqData.trend.change_percent,
                    is_improving: depFreqData.trend.is_improving,
                  }
                : undefined
            }
          />
          <KpiCard
            title="Change failure rate"
            value={relData?.failure_rate != null ? `${relData.failure_rate.toFixed(1)}%` : '—'}
            subtitle={relData?.mttr_hours != null ? `MTTR ${relData.mttr_hours}h` : undefined}
            to="/metrics/deployment-frequency"
            icon="📉"
            accent="orange"
            trend={
              relData?.trend
                ? {
                    change_percent: relData.trend.change_percent,
                    is_improving: relData.trend.is_improving,
                  }
                : undefined
            }
          />
        </div>

        <div className="dashboard__middle">
          <div className="card">
            <GlobalFlowChart
              data={fluxChartData}
              title={`Global flow (${formatDateRangeDisplay(startDate, endDate)})`}
              height={280}
            />
          </div>
          <div className="card">
            <h3 className="dashboard-section-title">Quick overview</h3>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>PRs in queue</span>
              <span>—</span>
            </div>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Median CI pipeline duration</span>
              <span>—</span>
            </div>
          </div>
        </div>

        {settings.data?.cursor_configured && cursor != null && (
          <div className="dashboard__middle" style={{ marginTop: 20 }}>
            <div className="card">
              {cursorUsageChartData.length > 0 ? (
                <>
                  <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Cursor — Usage</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={cursorUsageChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                        labelStyle={{ color: 'var(--text)' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="lines_added" name="Lines added" yAxisId="right" stroke="var(--metric-green)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="lines_deleted" name="Lines deleted" yAxisId="right" stroke="var(--metric-orange)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="composer" name="Composer" yAxisId="left" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="chat" name="Chat" yAxisId="left" stroke="var(--metric-blue)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="agent" name="Agent" yAxisId="left" stroke="var(--text-muted)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="tabs_accepted" name="Tabs accepted" yAxisId="left" stroke="var(--metric-blue)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontWeight: 600, margin: 0 }}>Cursor — Usage</p>
                  <p style={{ fontSize: '0.875rem', margin: 0 }}>No usage data yet. Data appears after Cursor Admin API returns daily usage.</p>
                </div>
              )}
            </div>
            {cursorSummaryBlock}
          </div>
        )}

        <div className="dashboard__bottom-three">
          <div className="card">
            <h3 className="dashboard-section-title">Bottleneck</h3>
            <div className="dashboard-bottleneck__item">
              <div className="dashboard-bottleneck__label">Slow reviews</div>
              {(reviewerWorkload.data as { reviewers?: { login: string; pending_hours?: number }[] } | undefined)
                ?.reviewers?.length ? (
                <div style={{ fontSize: '0.8125rem' }}>
                  {(reviewerWorkload.data as { reviewers: { login: string; pending_hours?: number }[] }).reviewers
                    .slice(0, 3)
                    .map((r) => (
                      <div key={r.login}>
                        {r.login}: {r.pending_hours != null ? `${r.pending_hours.toFixed(0)}h` : '—'}
                      </div>
                    ))}
                </div>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="dashboard-bottleneck__item">
              <div className="dashboard-bottleneck__label">Failures CI</div>
              <span>{relData?.failed_runs ?? 0} failed runs</span>
            </div>
            <div className="dashboard-bottleneck__item">
              <div className="dashboard-bottleneck__label">Avg failure rate</div>
              <span>{relData?.failure_rate != null ? `${relData.failure_rate.toFixed(0)}%` : '—'}</span>
            </div>
            <div className="dashboard-bottleneck__item">
              <div className="dashboard-bottleneck__label">Avg MTTR</div>
              <span>
                {relData?.mttr_hours != null ? `${relData.mttr_hours.toFixed(1)}h` : '—'}
              </span>
            </div>
          </div>

          <div className="card">
            <h3 className="dashboard-section-title">Period comparison</h3>
            <div className="dashboard-comparison">
              {comparisonRows.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Current</th>
                      <th>Previous</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.metric}>
                        <td>{row.metric}</td>
                        <td>{row.current}</td>
                        <td>{row.previous}</td>
                        <td
                          style={{
                            color:
                              row.trend?.is_improving === true
                                ? 'var(--metric-green)'
                                : row.trend?.change_percent !== 0
                                  ? 'var(--metric-orange)'
                                  : undefined,
                          }}
                        >
                          {row.trend != null
                            ? `${row.trend.change_percent >= 0 ? '+' : ''}${row.trend.change_percent}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No comparison data.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="dashboard-section-title">Alerts</h3>
            <ul className="dashboard-alerts__list">
              {(alerts.data?.alerts ?? []).length === 0 ? (
                <li className="dashboard-alerts__item" style={{ color: 'var(--text-muted)' }}>
                  No alerts in this period.
                </li>
              ) : (
                (alerts.data?.alerts ?? []).map((a: { rule_id: string; title: string; message?: string; severity?: string }) => (
                  <li key={a.rule_id} className="dashboard-alerts__item">
                    <div className="dashboard-alerts__title">{a.title}</div>
                    <div className="dashboard-alerts__meta">{a.message ?? a.severity}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
