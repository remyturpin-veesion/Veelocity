import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getRecommendations } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function RecommendationsScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'recommendations', startDate, endDate, repoId],
    queryFn: () => getRecommendations({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Recommendations</h1>
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
        <h1 className="screen-title">Recommendations</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const recs = data?.recommendations ?? [];

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/" label="Dashboard" />
      </p>
      <h1 className="screen-title">Recommendations</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate}
      </p>
      <div className="card">
        {recs.length === 0 ? (
          <div className="empty-state">No recommendations for this period.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recs.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: 'var(--accent)',
                  borderRadius: 8,
                  borderLeft: '4px solid var(--primary)',
                }}
              >
                <strong>{r.title}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>{r.description}</p>
                {r.priority && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.priority}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
