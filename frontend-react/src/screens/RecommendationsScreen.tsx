import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getProposedRecommendations } from '@/api/endpoints.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import type { Recommendation } from '@/types/index.js';

function formatRunDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  try {
    const s = new Date(start).toLocaleDateString(undefined, { dateStyle: 'short' });
    const e = new Date(end).toLocaleDateString(undefined, { dateStyle: 'short' });
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function RecCard({ r, periodLabel }: { r: Recommendation; periodLabel: string }) {
  return (
    <li
      style={{
        padding: 16,
        marginBottom: 12,
        background: 'var(--accent)',
        borderRadius: 8,
        borderLeft: '4px solid var(--primary)',
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1rem' }}>{r.title}</strong>
        {r.priority && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--primary)',
              textTransform: 'uppercase',
            }}
          >
            {r.priority}
          </span>
        )}
      </div>
      {r.description && (
        <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.5 }}>
          {r.description}
        </p>
      )}
      {r.metric_context && (
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {r.metric_context}
        </p>
      )}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {periodLabel && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Period: {periodLabel}</span>
        )}
        {r.link && (
          <Link
            to={r.link}
            style={{
              fontSize: '0.8125rem',
              color: 'var(--primary)',
              fontWeight: 500,
            }}
          >
            View metric →
          </Link>
        )}
      </div>
    </li>
  );
}

export function RecommendationsScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'recommendations', 'proposed'],
    queryFn: getProposedRecommendations,
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="screen-title">Recommendations</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <h1 className="screen-title">Recommendations</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const recs = data?.recommendations ?? [];
  const runAt = data?.run_at ?? null;
  const periodStart = data?.period_start ?? null;
  const periodEnd = data?.period_end ?? null;
  const periodLabel = formatPeriod(periodStart, periodEnd);

  return (
    <div>
      <h1 className="screen-title">Recommendations</h1>
      {runAt && (
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.875rem' }}>
          Last proposed: {formatRunDate(runAt)}
        </p>
      )}
      <div className="card">
        {recs.length === 0 ? (
          <div className="empty-state">
            No recommendations yet. Recommendations are proposed every 10 minutes; run a sync and wait for the next run, or
            check back later.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recs.map((r) => (
              <RecCard key={r.id} r={r} periodLabel={periodLabel} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
