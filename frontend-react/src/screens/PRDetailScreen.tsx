import { useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { useQuery } from '@tanstack/react-query';
import { getPRDetail } from '@/api/endpoints.js';

export function PRDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const prId = id ? parseInt(id, 10) : NaN;

  const { data, isLoading, error } = useQuery({
    queryKey: ['pr', prId],
    queryFn: () => getPRDetail(prId, true),
    enabled: Number.isInteger(prId),
  });

  if (!id || !Number.isInteger(prId)) return <div className="error">Invalid PR id</div>;
  if (isLoading) return <div className="loading">Loading PR…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  if (!data) return null;

  const repo = data.repository;
  const githubUrl = repo ? `https://github.com/${repo.full_name}/pull/${data.number}` : null;

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/github" label="GitHub" /> → PR #{data.number}
      </p>
      <h1 className="screen-title">{data.title}</h1>
      <div className="card">
        <div className="card__title">PR #{data.number}</div>
        <p style={{ margin: '4px 0 0' }}>
          by {data.author_login} · state: {data.state}
          {data.draft && ' (draft)'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          +{data.additions} / −{data.deletions}
          {data.merged_at && ` · merged ${data.merged_at}`}
        </p>
        {githubUrl && (
          <a href={githubUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: 'inline-block' }}>
            Open on GitHub →
          </a>
        )}
      </div>
      {data.health && (
        <div className="card">
          <div className="card__title">Health</div>
          <div className="card__value">{data.health.health_score}</div>
          <p style={{ margin: '4px 0 0' }}>{data.health.health_category}</p>
          {data.health.issues?.length > 0 && (
            <ul style={{ marginTop: 8 }}>
              {data.health.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="card">
        <div className="card__title">Reviews</div>
        {data.reviews?.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No reviews</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.reviews?.map((r, i) => (
              <li key={i} style={{ padding: '4px 0' }}>
                {r.reviewer_login}: {r.state}
                {r.submitted_at && ` at ${r.submitted_at}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <div className="card__title">Comments</div>
        {data.comments?.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No comments</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.comments?.slice(0, 10).map((c, i) => (
              <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <strong>{c.author_login}</strong>: {c.body.slice(0, 120)}
                {c.body.length > 120 ? '…' : ''}
              </li>
            ))}
            {data.comments && data.comments.length > 10 && (
              <li style={{ paddingTop: 8, color: 'var(--text-muted)' }}>
                +{data.comments.length - 10} more
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
