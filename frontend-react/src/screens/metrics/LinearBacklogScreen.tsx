import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, TEAM_ID_NONE, formatDateRangeDisplay } from '@/stores/filters.js';
import { getLinearBacklog, getLinearTimeInState } from '@/api/endpoints.js';

import { KpiCard } from '@/components/KpiCard.js';

import { SkeletonCard } from '@/components/SkeletonCard.js';

export function LinearBacklogScreen() {
  useFiltersStore((s) => s.teamIds);
  useFiltersStore((s) => s.dateRange);
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const teamIdsParam = getTeamIdsForApi();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'linear', 'backlog', teamIdsParam],
    queryFn: () =>
      getLinearBacklog({
        team_ids:
          teamIdsParam && teamIdsParam.length > 0 && !(teamIdsParam.length === 1 && teamIdsParam[0] === TEAM_ID_NONE)
            ? teamIdsParam.filter((id) => id !== TEAM_ID_NONE)
            : undefined,
        no_teams: teamIdsParam?.length === 1 && teamIdsParam[0] === TEAM_ID_NONE,
      }),
  });

  const { data: timeInStateData } = useQuery({
    queryKey: ['metrics', 'linear', 'time-in-state', startDate, endDate, teamIdsParam],
    queryFn: () =>
      getLinearTimeInState({
        start_date: startDate,
        end_date: endDate,
        team_ids:
          teamIdsParam && teamIdsParam.length > 0 && !(teamIdsParam.length === 1 && teamIdsParam[0] === TEAM_ID_NONE)
            ? teamIdsParam.filter((id) => id !== TEAM_ID_NONE)
            : undefined,
        no_teams: teamIdsParam?.length === 1 && teamIdsParam[0] === TEAM_ID_NONE,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="screen-title">Backlog & status</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <h1 className="screen-title">Backlog & status</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    backlog_count?: number;
    total?: number;
    by_team?: Array<{ team_id?: number; team_name?: string; count: number }>;
    by_state?: Array<{ state_name: string; count: number }>;
  };
  const tis = timeInStateData as { stages?: Array<{ label: string; median_hours?: number; average_hours?: number }> } | undefined;
  const totalOpen = d.backlog_count ?? d.total ?? 0;
  const byState = d.by_state ?? [];
  const stageTimeByLabel = new Map<string, { median_hours: number; average_hours: number }>();
  for (const s of tis?.stages ?? []) {
    stageTimeByLabel.set(s.label, {
      median_hours: s.median_hours ?? 0,
      average_hours: s.average_hours ?? 0,
    });
  }

  return (
    <div>
      <h1 className="screen-title">Backlog & status</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Open issues (not completed or canceled) by workflow status. Median time in state for issues completed in the period.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Open issues" value={String(totalOpen)} />
      </div>

      {byState.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card__title">By status</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
            {formatDateRangeDisplay(startDate, endDate)} — median time in state for completed issues.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {byState.map((s) => {
              const time = stageTimeByLabel.get(s.state_name);
              const medianH = time?.median_hours;
              const subtitle =
                medianH != null && medianH > 0
                  ? `median ${medianH < 24 ? `${medianH.toFixed(1)} h` : `${(medianH / 24).toFixed(1)} d`}`
                  : undefined;
              return (
                <KpiCard
                  key={s.state_name}
                  title={s.state_name}
                  value={String(s.count)}
                  subtitle={subtitle}
                />
              );
            })}
          </div>
        </div>
      )}

      {d.by_team && d.by_team.length > 0 ? (
        <div className="card">
          <div className="card__title">By team</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {d.by_team.map((t) => (
              <li
                key={t.team_id ?? t.team_name ?? ''}
                style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}
              >
                {t.team_name ?? `Team ${t.team_id}`}: {t.count}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card">
          <div className="card__title">By team</div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            No team breakdown. Sync Linear and ensure teams are configured, or clear the team filter.
          </p>
        </div>
      )}
    </div>
  );
}
