import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getLinearIssuesCompleted } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function LinearIssuesCompletedScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  useFiltersStore((s) => s.teamIds); // subscribe so we re-render when team filter changes
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const teamIdsParam = getTeamIdsForApi();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'linear', 'issues-completed', startDate, endDate, teamIdsParam],
    queryFn: () =>
      getLinearIssuesCompleted({
        start_date: startDate,
        end_date: endDate,
        team_ids: teamIdsParam && teamIdsParam.length > 0 ? teamIdsParam : undefined,
        no_teams: teamIdsParam && teamIdsParam.length === 0,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/linear" label="Linear" />
        </p>
        <div className="screen-title-row"><h1 className="screen-title">Linear issues completed</h1><MetricInfoButton metricKey="linear-issues-completed" /></div>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/linear" label="Linear" />
        </p>
        <div className="screen-title-row"><h1 className="screen-title">Linear issues completed</h1><MetricInfoButton metricKey="linear-issues-completed" /></div>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    total?: number;
    data?: Array<{ period: string; count: number }>;
  };
  const chartData = (d.data ?? []).map((p) => ({ label: p.period, value: p.count }));

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/linear" label="Linear" />
      </p>
      <div className="screen-title-row"><h1 className="screen-title">Linear issues completed</h1><MetricInfoButton metricKey="linear-issues-completed" /></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Total completed" value={String(d.total ?? '—')} />
      </div>
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <TrendChart data={chartData} title="Issues completed over time" height={240} />
        </div>
      )}
    </div>
  );
}
