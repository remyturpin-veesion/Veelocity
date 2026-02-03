import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getLinearTimeInState } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { KpiCard } from '@/components/KpiCard.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

interface TimeInStateStage {
  id: string;
  label: string;
  count: number;
  average_hours: number;
  [key: string]: unknown;
}

export function LinearTimeInStateScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const teamIds = useFiltersStore((s) => s.teamIds);
  const timeInStateStageIds = useFiltersStore((s) => s.timeInStateStageIds);
  const setTimeInStateStageIds = useFiltersStore((s) => s.setTimeInStateStageIds);
  const teamIdsArray = teamIds.size ? Array.from(teamIds) : undefined;
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'linear', 'time-in-state', startDate, endDate, teamIdsArray],
    queryFn: () =>
      getLinearTimeInState({
        start_date: startDate,
        end_date: endDate,
        team_ids: teamIdsArray,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/linear" label="Linear" />
        </p>
        <h1 className="screen-title">Linear time in state</h1>
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
        <h1 className="screen-title">Linear time in state</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    start_date?: string;
    end_date?: string;
    stages?: TimeInStateStage[];
    data?: Array<{ period: string; value: number }>;
  };
  const allStages = d.stages ?? [];
  const chartData = (d.data ?? []).map((p) => ({ label: p.period, value: p.value }));

  const allStagesSelected =
    allStages.length === 0 || timeInStateStageIds.size === 0 || timeInStateStageIds.size === allStages.length;
  const visibleStages =
    allStagesSelected || timeInStateStageIds.size === 0
      ? allStages
      : allStages.filter((s) => timeInStateStageIds.has(s.id));

  const toggleStage = (id: string, selected: boolean) => {
    if (timeInStateStageIds.size === 0) {
      if (selected) return;
      setTimeInStateStageIds(allStages.map((s) => s.id).filter((x) => x !== id));
    } else {
      const next = new Set(timeInStateStageIds);
      if (selected) {
        next.add(id);
        setTimeInStateStageIds(next.size === allStages.length ? [] : next);
      } else {
        next.delete(id);
        setTimeInStateStageIds(next.size ? next : []);
      }
    }
  };

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/linear" label="Linear" />
      </p>
      <h1 className="screen-title">Linear time in state</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {d.start_date} – {d.end_date}
      </p>

      {allStages.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span className="filter-label muted">Stages:</span>
          <div className="filter-chips" style={{ display: 'inline-flex', marginLeft: 8, flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="filter-chip"
              data-selected={allStagesSelected ? '' : undefined}
              onClick={() => setTimeInStateStageIds([])}
            >
              All
            </button>
            {allStages.map((s) => {
              const selected = allStagesSelected || timeInStateStageIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="filter-chip"
                  data-selected={selected ? '' : undefined}
                  onClick={() => toggleStage(s.id, !selected)}
                >
                  {s.label} ({s.count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {visibleStages.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {visibleStages.map((s) => (
            <KpiCard
              key={s.id}
              title={s.label}
              value={s.average_hours != null ? `${s.average_hours.toFixed(1)} h` : '—'}
              subtitle={s.count != null ? `${s.count} issues` : undefined}
            />
          ))}
        </div>
      )}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <TrendChart data={chartData} title="Time in state over time" height={240} />
        </div>
      )}
    </div>
  );
}
