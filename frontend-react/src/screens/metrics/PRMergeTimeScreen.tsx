import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getPRMergeTime } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function PRMergeTimeScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  useFiltersStore((s) => s.developerLogins);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const getDeveloperLoginsForApi = useFiltersStore((s) => s.getDeveloperLoginsForApi);
  const developerLoginsParam = getDeveloperLoginsForApi();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'pr-merge-time', startDate, endDate, repoIds, developerLoginsParam],
    queryFn: () =>
      getPRMergeTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });

  if (noReposSelected) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">PR merge time</h1><MetricInfoButton metricKey="pr-merge-time" /></div>
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
        <div className="screen-title-row"><h1 className="screen-title">PR merge time</h1><MetricInfoButton metricKey="pr-merge-time" /></div>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">PR merge time</h1><MetricInfoButton metricKey="pr-merge-time" /></div>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as { count?: number; average_hours?: number };

  return (
    <div>
      <div className="screen-title-row"><h1 className="screen-title">PR merge time</h1><MetricInfoButton metricKey="pr-merge-time" /></div>
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
