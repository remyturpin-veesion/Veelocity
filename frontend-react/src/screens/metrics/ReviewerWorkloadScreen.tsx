import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getReviewerWorkload } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { EmptyState } from '@/components/EmptyState.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function ReviewerWorkloadScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'reviewer-workload', startDate, endDate, repoIds],
    queryFn: () =>
      getReviewerWorkload({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
      }),
    enabled: !noReposSelected,
  });

  if (noReposSelected) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Reviewer workload</h1>
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
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Reviewer workload</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Reviewer workload</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    reviewers?: Array<{ reviewer_login: string; review_count: number; share?: number }>;
    summary?: { gini_coefficient?: number };
  };
  const reviewers = d.reviewers ?? [];

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/" label="Dashboard" />
      </p>
      <h1 className="screen-title">Reviewer workload</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
        {d.summary?.gini_coefficient != null && ` · Gini: ${d.summary.gini_coefficient.toFixed(2)}`}
      </p>
      <div className="card">
        <div className="card__title">Reviewers</div>
        {reviewers.length === 0 ? (
          <div className="empty-state">No review data in this period.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {reviewers.map((r) => (
              <li key={r.reviewer_login} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <strong>{r.reviewer_login}</strong>: {r.review_count} reviews
                {r.share != null && ` (${(r.share * 100).toFixed(0)}%)`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
