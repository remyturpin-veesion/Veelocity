import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getPRReviewTime } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function PRReviewTimeScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'pr-review-time', startDate, endDate, repoIds],
    queryFn: () =>
      getPRReviewTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });

  if (noReposSelected) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">PR review time</h1><MetricInfoButton metricKey="pr-review-time" /></div>
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
        <div className="screen-title-row"><h1 className="screen-title">PR review time</h1><MetricInfoButton metricKey="pr-review-time" /></div>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">PR review time</h1><MetricInfoButton metricKey="pr-review-time" /></div>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as { count?: number; average_hours?: number };

  return (
    <div>
      <div className="screen-title-row"><h1 className="screen-title">PR review time</h1><MetricInfoButton metricKey="pr-review-time" /></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard title="PRs" value={String(d.count ?? '—')} />
        <KpiCard title="Average (hours)" value={d.average_hours != null ? d.average_hours.toFixed(1) : '—'} />
      </div>
    </div>
  );
}
