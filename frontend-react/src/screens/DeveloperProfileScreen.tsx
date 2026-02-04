import { useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getDeveloperStats } from '@/api/endpoints.js';

export function DeveloperProfileScreen() {
  const { login } = useParams<{ login: string }>();
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', login, startDate, endDate, repoId],
    queryFn: () =>
      getDeveloperStats(login!, { start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
    enabled: !!login,
  });

  if (!login) return <div className="error">Missing developer login</div>;
  if (isLoading) return <div className="loading">Loading…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/team" label="Team" /> → <strong>{data.login}</strong>
      </p>
      <h1 className="screen-title">{data.login}</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate}
      </p>
      <div className="card">
        <div className="card__title">PRs</div>
        <div className="card__value">{data.prs_merged}</div>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>merged (open: {data.prs_open})</p>
      </div>
      <div className="card">
        <div className="card__title">Reviews & comments</div>
        <div>Reviews: {data.reviews_given} · Comments: {data.comments_made}</div>
      </div>
      <div className="card">
        <div className="card__title">Code</div>
        <div>+{data.total_additions} / −{data.total_deletions} · Avg merge: {data.avg_merge_hours.toFixed(1)} h</div>
      </div>
    </div>
  );
}
