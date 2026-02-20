import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getThroughput } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function ThroughputScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  useFiltersStore((s) => s.developerLogins);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getChartPeriod = useFiltersStore((s) => s.getChartPeriod);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const getDeveloperLoginsForApi = useFiltersStore((s) => s.getDeveloperLoginsForApi);
  const developerLoginsParam = getDeveloperLoginsForApi();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();
  const period = getChartPeriod();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'throughput', startDate, endDate, repoIds, developerLoginsParam, period],
    queryFn: () =>
      getThroughput({
        start_date: startDate,
        end_date: endDate,
        period,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        include_trend: true,
        include_benchmark: true,
      }),
    enabled: !noReposSelected,
  });

  if (noReposSelected) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">Throughput</h1><MetricInfoButton metricKey="throughput" /></div>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see this metric."
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">Throughput</h1><MetricInfoButton metricKey="throughput" /></div>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">Throughput</h1><MetricInfoButton metricKey="throughput" /></div>
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
      <div className="screen-title-row"><h1 className="screen-title">Throughput</h1><MetricInfoButton metricKey="throughput" /></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="PRs merged" value={String(d.total ?? '—')} />
      </div>
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <TrendChart data={chartData} title="Merged PRs over time" height={240} />
        </div>
      )}
    </div>
  );
}
