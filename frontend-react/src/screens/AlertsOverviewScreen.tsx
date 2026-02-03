import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getAlerts } from '@/api/endpoints.js';

export function AlertsOverviewScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts', startDate, endDate, repoId],
    queryFn: () => getAlerts({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });

  if (isLoading) return <div className="loading">Loading alerts…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const alerts = data?.alerts ?? [];
  return (
    <div>
      <h1 className="screen-title">Alerts</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {data?.start_date} – {data?.end_date}
      </p>
      <div className="card">
        {alerts.length === 0 ? (
          <div className="empty-state">No alerts in this period.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {alerts.map((a) => (
              <li
                key={a.rule_id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: 'var(--accent)',
                  borderRadius: 8,
                  borderLeft: `4px solid var(--primary)`,
                }}
              >
                <strong>{a.title}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{a.message}</p>
                <span style={{ fontSize: '0.75rem' }}>{a.severity} · {a.metric}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
