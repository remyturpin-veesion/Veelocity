import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getLinearBacklog } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { KpiCard } from '@/components/KpiCard.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function LinearBacklogScreen() {
  useFiltersStore((s) => s.teamIds); // subscribe so we re-render when team filter changes
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const teamIdsParam = getTeamIdsForApi();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'linear', 'backlog', teamIdsParam],
    queryFn: () =>
      getLinearBacklog({
        team_ids: teamIdsParam && teamIdsParam.length > 0 ? teamIdsParam : undefined,
        no_teams: teamIdsParam && teamIdsParam.length === 0,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/linear" label="Linear" />
        </p>
        <h1 className="screen-title">Linear backlog</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/linear" label="Linear" />
        </p>
        <h1 className="screen-title">Linear backlog</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as { total?: number; by_team?: Array<{ team_id?: number; team_name?: string; count: number }> };

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/linear" label="Linear" />
      </p>
      <h1 className="screen-title">Linear backlog</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Open issues" value={String(d.total ?? '—')} />
      </div>
      {d.by_team && d.by_team.length > 0 && (
        <div className="card">
          <div className="card__title">By team</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {d.by_team.map((t) => (
              <li key={t.team_id ?? t.team_name ?? ''} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                {t.team_name ?? `Team ${t.team_id}`}: {t.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
