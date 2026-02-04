import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getCycleTime } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { KpiCard } from '@/components/KpiCard.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function CycleTimeScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  useFiltersStore((s) => s.teamIds); // subscribe so we re-render when team filter changes
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const teamIdsParam = getTeamIdsForApi();
  const teamId =
    teamIdsParam?.length === 0 ? -1 : teamIdsParam?.length === 1 ? teamIdsParam[0] : undefined;
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'cycle-time', startDate, endDate, teamId],
    queryFn: () =>
      getCycleTime({
        start_date: startDate,
        end_date: endDate,
        team_id: teamId ?? undefined,
        include_benchmark: true,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Cycle time</h1>
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
        <h1 className="screen-title">Cycle time</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as { count?: number; average_hours?: number };

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/" label="Dashboard" />
      </p>
      <h1 className="screen-title">Cycle time</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard title="Issues" value={String(d.count ?? '—')} />
        <KpiCard title="Average (hours)" value={d.average_hours != null ? d.average_hours.toFixed(1) : '—'} />
      </div>
    </div>
  );
}
