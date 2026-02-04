import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getPRHealth } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { KpiCard } from '@/components/KpiCard.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function PRHealthScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'pr-health', startDate, endDate, repoIds],
    queryFn: () =>
      getPRHealth({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_summary: true,
      }),
    enabled: !noReposSelected,
  });

  if (noReposSelected) {
    return (
      <div>
        <h1 className="screen-title">PR health</h1>
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
        <h1 className="screen-title">PR health</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <h1 className="screen-title">PR health</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    count?: number;
    summary?: { average_score?: number };
    pr_health_scores?: Array<{ pr_id: number; pr_number?: number; title?: string; health_score: number; health_category?: string }>;
  };
  const scores = d.pr_health_scores ?? [];
  const summary = d.summary;

  return (
    <div>
      <h1 className="screen-title">PR health</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="PRs scored" value={String(d.count ?? 0)} />
        {summary?.average_score != null && (
          <KpiCard title="Average score" value={summary.average_score.toFixed(0)} />
        )}
      </div>
      <div className="card">
        <div className="card__title">PRs</div>
        {scores.length === 0 ? (
          <div className="empty-state">No PRs in this period.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {scores.slice(0, 30).map((pr) => (
              <li key={pr.pr_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <Link to={`/pr/${pr.pr_id}`}>
                  #{pr.pr_number ?? pr.pr_id} {pr.title ?? ''} — score {pr.health_score}
                  {pr.health_category ? ` (${pr.health_category})` : ''}
                </Link>
              </li>
            ))}
            {scores.length > 30 && (
              <li style={{ paddingTop: 8, color: 'var(--text-muted)' }}>+{scores.length - 30} more</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
