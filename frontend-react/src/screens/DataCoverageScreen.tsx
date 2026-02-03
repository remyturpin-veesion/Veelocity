import { useQuery } from '@tanstack/react-query';
import { getSyncCoverage } from '@/api/endpoints.js';

export function DataCoverageScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sync', 'coverage'],
    queryFn: () => getSyncCoverage(),
  });

  if (isLoading) return <div className="loading">Loading coverage…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  return (
    <div>
      <h1 className="screen-title">Data coverage</h1>
      <div className="card">
        <div className="card__title">Totals</div>
        <div>
          PRs: {data?.total_pull_requests ?? 0} · Commits: {data?.total_commits ?? 0} · Workflow runs:{' '}
          {data?.total_workflow_runs ?? 0} · Developers: {data?.total_developers ?? 0}
        </div>
      </div>
      <div className="card">
        <div className="card__title">Connectors</div>
        {data?.connectors?.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.connectors.map((c) => (
              <li key={c.connector_name} style={{ padding: '4px 0' }}>
                {c.display_name ?? c.connector_name}: last sync {c.last_sync_at ?? 'never'}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">No connector state.</div>
        )}
      </div>
    </div>
  );
}
