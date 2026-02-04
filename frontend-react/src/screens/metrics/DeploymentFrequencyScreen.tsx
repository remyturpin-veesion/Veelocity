import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getDeploymentFrequency, getDeploymentReliability } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { KpiCard } from '@/components/KpiCard.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function DeploymentFrequencyScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoIds],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
        include_benchmark: true,
      }),
    enabled: !noReposSelected,
  });
  const reliability = useQuery({
    queryKey: ['metrics', 'deployment-reliability', startDate, endDate, repoIds],
    queryFn: () =>
      getDeploymentReliability({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
      }),
    enabled: !noReposSelected,
  });

  if (noReposSelected) {
    return (
      <div>
        <h1 className="screen-title">Deployment frequency</h1>
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
        <h1 className="screen-title">Deployment frequency</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <h1 className="screen-title">Deployment frequency</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    period?: string;
    data?: Array<{ period: string; count: number }>;
    total?: number;
    average?: number;
  };
  const rel = reliability.data as {
    total_runs?: number;
    successful_runs?: number;
    failed_runs?: number;
    failure_rate?: number;
    stability_score?: number;
  } | undefined;

  const chartData = (d.data ?? []).map((p) => ({ label: p.period, value: p.count }));

  return (
    <div>
      <h1 className="screen-title">Deployment frequency</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Total deployments" value={String(d.total ?? '—')} />
        <KpiCard title="Average per week" value={String(d.average ?? '—')} />
        {rel != null && (
          <>
            <KpiCard title="Successful runs" value={String(rel.successful_runs ?? '—')} />
            <KpiCard title="Stability score" value={rel.stability_score != null ? `${(rel.stability_score * 100).toFixed(0)}%` : '—'} />
          </>
        )}
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <TrendChart data={chartData} title="Deployments over time" height={240} />
      </div>
    </div>
  );
}
