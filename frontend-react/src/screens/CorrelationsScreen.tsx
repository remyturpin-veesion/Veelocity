import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getCorrelations } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function CorrelationsScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'correlations', startDate, endDate, repoId],
    queryFn: () => getCorrelations({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Correlations</h1>
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
        <h1 className="screen-title">Correlations</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const correlations = data?.correlations ?? [];

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/" label="Dashboard" />
      </p>
      <h1 className="screen-title">Correlations</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate}
      </p>
      <div className="card">
        {correlations.length === 0 ? (
          <div className="empty-state">No correlation data for this period.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {correlations.map((c, i) => (
              <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <strong>{c.metric_a}</strong> ↔ <strong>{c.metric_b}</strong>: {typeof c.correlation === 'number' ? c.correlation.toFixed(3) : c.correlation}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
