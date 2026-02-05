import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getCycleTime, getCycleTimeByPeriod } from '@/api/endpoints.js';
import type { TrendData } from '@/types/index.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { TrendChart } from '@/components/TrendChart.js';

function formatCycleHours(hours: number): string {
  if (hours >= 24) {
    const days = hours / 24;
    return `${days.toFixed(1)} days`;
  }
  return `${hours.toFixed(1)} hrs`;
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: 'short' });
}

export function CycleTimeScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getChartPeriod = useFiltersStore((s) => s.getChartPeriod);
  useFiltersStore((s) => s.teamIds);
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const teamIdsParam = getTeamIdsForApi();
  const teamId =
    teamIdsParam?.length === 0 ? -1 : teamIdsParam?.length === 1 ? teamIdsParam[0] : undefined;
  const { startDate, endDate } = getStartEnd();
  const chartPeriod = getChartPeriod();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'cycle-time', startDate, endDate, teamId],
    queryFn: () =>
      getCycleTime({
        start_date: startDate,
        end_date: endDate,
        team_id: teamId ?? undefined,
        include_trend: true,
        include_benchmark: true,
        include_breakdown: true,
      }),
  });

  const { data: byPeriodData } = useQuery({
    queryKey: ['metrics', 'cycle-time-by-period', startDate, endDate, teamId, chartPeriod],
    queryFn: () =>
      getCycleTimeByPeriod({
        start_date: startDate,
        end_date: endDate,
        period: chartPeriod,
        team_id: teamId ?? undefined,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">Cycle time</h1><MetricInfoButton metricKey="cycle-time" /></div>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">Cycle time</h1><MetricInfoButton metricKey="cycle-time" /></div>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    count?: number;
    average_hours?: number;
    median_hours?: number;
    trend?: TrendData;
    issues?: Array<{
      issue_id: number;
      identifier: string;
      title?: string;
      hours: number;
      started_at?: string | null;
      merged_at?: string | null;
    }>;
  };
  const byPeriod = (Array.isArray(byPeriodData) ? byPeriodData : []) as { period: string; median_hours: number }[];
  const chartData = byPeriod.map((p) => ({ label: p.period, value: p.median_hours }));
  const issues = d.issues ?? [];

  const trendForKpi =
    d.trend != null
      ? { change_percent: d.trend.change_percent, is_improving: d.trend.is_improving }
      : undefined;

  return (
    <div>
      <div className="screen-title-row"><h1 className="screen-title">Cycle time</h1><MetricInfoButton metricKey="cycle-time" /></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Issues" value={String(d.count ?? '—')} />
        <KpiCard
          title="Average (hours)"
          value={d.average_hours != null ? d.average_hours.toFixed(1) : '—'}
          trend={trendForKpi}
        />
        {d.median_hours != null && (
          <KpiCard title="Median (hours)" value={d.median_hours.toFixed(1)} />
        )}
      </div>

      {d.trend != null && (
        <div className="card" style={{ marginBottom: 24, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>Current vs previous period</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'baseline' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Current period</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCycleHours(d.average_hours ?? 0)}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Previous period</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCycleHours(d.trend.previous_value ?? 0)}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Change</span>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: d.trend.is_improving ? 'var(--metric-green)' : 'var(--metric-orange)',
                }}
              >
                {(d.trend.change_percent >= 0 ? '+' : '') + d.trend.change_percent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <TrendChart
            data={chartData}
            title="Cycle time evolution (median by period)"
            height={280}
          />
        </div>
      )}

      {issues.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>
            Issues included in this metric
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>
            All Linear issues linked to a merged PR in the selected period (cycle time = issue started → PR merged).
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>Issue</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Title</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Cycle time</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Started</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Merged</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => (
                <tr key={row.issue_id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '8px 12px 8px 0', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                    {row.identifier}
                  </td>
                  <td style={{ padding: '8px 12px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>
                    {row.title ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{formatCycleHours(row.hours)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {formatDateShort(row.started_at)}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {formatDateShort(row.merged_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
