import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import {
  getDeploymentFrequency,
  getLeadTime,
  getCycleTime,
  getDeploymentReliability,
  getLeadTimeByPeriod,
  getCycleTimeByPeriod,
  getAlerts,
  getReviewerWorkload,
  getLinearTeams,
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

function getChartDateRange(endDate: string): { start: string; end: string } {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 13);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function DashboardScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();
  const chartRange = useMemo(() => getChartDateRange(endDate), [endDate]);

  const deploymentFreq = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoId],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        period: 'day',
        include_trend: true,
      }),
  });
  const leadTime = useQuery({
    queryKey: ['metrics', 'lead-time', startDate, endDate, repoId],
    queryFn: () =>
      getLeadTime({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });
  const cycleTime = useQuery({
    queryKey: ['metrics', 'cycle-time', startDate, endDate, repoId],
    queryFn: () =>
      getCycleTime({
        start_date: startDate,
        end_date: endDate,
        include_trend: true,
      }),
  });
  const deploymentReliability = useQuery({
    queryKey: ['metrics', 'deployment-reliability', startDate, endDate, repoId],
    queryFn: () =>
      getDeploymentReliability({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });

  const deploymentFreqChart = useQuery({
    queryKey: ['metrics', 'deployment-frequency', chartRange.start, chartRange.end, repoId, 'day'],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: chartRange.start,
        end_date: chartRange.end,
        repo_id: repoId ?? undefined,
        period: 'day',
      }),
  });
  const leadTimeByPeriod = useQuery({
    queryKey: ['metrics', 'lead-time-by-period', chartRange.start, chartRange.end, repoId],
    queryFn: () =>
      getLeadTimeByPeriod({
        start_date: chartRange.start,
        end_date: chartRange.end,
        period: 'day',
        repo_id: repoId ?? undefined,
      }),
  });
  const cycleTimeByPeriod = useQuery({
    queryKey: ['metrics', 'cycle-time-by-period', chartRange.start, chartRange.end],
    queryFn: () =>
      getCycleTimeByPeriod({
        start_date: chartRange.start,
        end_date: chartRange.end,
        period: 'day',
      }),
  });

  const alerts = useQuery({
    queryKey: ['alerts', startDate, endDate, repoId],
    queryFn: () => getAlerts({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });
  const reviewerWorkload = useQuery({
    queryKey: ['metrics', 'reviewer-workload', startDate, endDate, repoId],
    queryFn: () =>
      getReviewerWorkload({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });
  const linearTeams = useQuery({
    queryKey: ['linear', 'teams'],
    queryFn: () => getLinearTeams({ limit: 10 }),
  });

  const isLoading =
    deploymentFreq.isLoading ||
    leadTime.isLoading ||
    cycleTime.isLoading ||
    deploymentReliability.isLoading;
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
              title="Global flow (last 14 days)"
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

        <div className="card">
          <h3 className="dashboard-section-title">Performance by team</h3>
          <div className="dashboard-team-perf">
            <TeamCycleTimeTable
              teams={(linearTeams.data?.items ?? []) as { id: number; name?: string }[]}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamCycleTimeRow({
  team,
  startDate,
  endDate,
}: {
  team: { id: number; name?: string };
  startDate: string;
  endDate: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics', 'cycle-time', startDate, endDate, team.id],
    queryFn: () => getCycleTime({ start_date: startDate, end_date: endDate, team_id: team.id }),
  });
  const cycleData = data as { average_hours?: number; count?: number } | undefined;
  return (
    <tr>
      <td>{team.name ?? `Team ${team.id}`}</td>
      <td>
        {cycleData?.average_hours != null
          ? formatLeadOrCycleHours(cycleData.average_hours)
          : isLoading
            ? '…'
            : '—'}
      </td>
      <td>{cycleData?.count ?? (isLoading ? '…' : '—')}</td>
    </tr>
  );
}

function TeamCycleTimeTable({
  teams,
  startDate,
  endDate,
}: {
  teams: { id: number; name?: string }[];
  startDate: string;
  endDate: string;
}) {
  if (teams.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No teams. Configure Linear to see cycle time by team.
      </p>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Team</th>
          <th>Cycle time</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team) => (
          <TeamCycleTimeRow
            key={team.id}
            team={team}
            startDate={startDate}
            endDate={endDate}
          />
        ))}
      </tbody>
    </table>
  );
}
