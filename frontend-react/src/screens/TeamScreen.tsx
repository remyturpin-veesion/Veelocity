import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getDevelopers } from '@/api/endpoints.js';

export function TeamScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['developers', startDate, endDate, repoId],
    queryFn: () => getDevelopers({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });

  if (isLoading) return <div className="loading">Loading developers…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const developers = data?.developers ?? [];
  return (
    <div>
      <h1 className="screen-title">Team</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate} · {data?.count ?? 0} developers
      </p>
      <div className="card">
        {developers.length === 0 ? (
          <div className="empty-state">No developers in this period.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {developers.map((d) => (
              <li key={d.login} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <Link to={`/team/developer/${encodeURIComponent(d.login)}`}>
                  {d.avatar && (
                    <img
                      src={d.avatar}
                      alt=""
                      width={24}
                      height={24}
                      style={{ borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }}
                    />
                  )}
                  <strong>{d.login}</strong>
                  <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                    PRs: {d.prs_merged} merged, {d.reviews_given} reviews
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
