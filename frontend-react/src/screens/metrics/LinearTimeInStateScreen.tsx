import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay, TEAM_ID_NONE } from '@/stores/filters.js';
import { getLinearTimeInState } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

interface TimeInStateStage {
  id: string;
  label: string;
  count: number;
  average_hours: number;
  [key: string]: unknown;
}

export function LinearTimeInStateScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  useFiltersStore((s) => s.teamIds); // subscribe so we re-render when team filter changes
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const teamIdsParam = getTeamIdsForApi();
  const timeInStateStageIds = useFiltersStore((s) => s.timeInStateStageIds);
  const setTimeInStateStageIds = useFiltersStore((s) => s.setTimeInStateStageIds);
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
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

  const stagesDropdownRef = useRef<HTMLDivElement>(null);
  const [stagesOpen, setStagesOpen] = useState(false);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stagesDropdownRef.current && !stagesDropdownRef.current.contains(e.target as Node)) {
        setStagesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/linear" label="Linear" />
        </p>
        <div className="screen-title-row"><h1 className="screen-title">Linear time in state</h1><MetricInfoButton metricKey="linear-time-in-state" /></div>
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
        <div className="screen-title-row"><h1 className="screen-title">Linear time in state</h1><MetricInfoButton metricKey="linear-time-in-state" /></div>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
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

  const stagesLabel =
    allStagesSelected ? 'All' : `${visibleStages.length} stage${visibleStages.length !== 1 ? 's' : ''}`;

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/linear" label="Linear" />
      </p>
      <div className="screen-title-row"><h1 className="screen-title">Linear time in state</h1><MetricInfoButton metricKey="linear-time-in-state" /></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>

      {allStages.length > 0 && (
        <div ref={stagesDropdownRef} className="filter-dropdown-wrap" style={{ marginBottom: 16 }}>
          <span className="filter-label muted" style={{ flex: '0 0 72px' }}>Stages</span>
          <button
            type="button"
            className="filter-dropdown-trigger"
            onClick={() => setStagesOpen((o) => !o)}
            aria-expanded={stagesOpen}
            aria-haspopup="listbox"
          >
            <span>{stagesLabel}</span>
            <ChevronDown />
          </button>
          {stagesOpen && (
            <div className="filter-dropdown-popover" role="listbox" aria-label="Select stages" style={{ minWidth: 220 }}>
              <button
                type="button"
                role="option"
                className={`filter-dropdown-option ${allStagesSelected ? 'filter-dropdown-option--selected' : ''}`}
                aria-selected={allStagesSelected}
                onClick={() => setTimeInStateStageIds([])}
              >
                <span className="filter-dropdown-option__check" aria-hidden>{allStagesSelected ? '✓' : ''}</span>
                All
              </button>
              {allStages.map((s) => {
                const selected = allStagesSelected || timeInStateStageIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    role="option"
                    aria-selected={selected}
                    className={`filter-dropdown-option ${selected ? 'filter-dropdown-option--selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="filter-dropdown-option__check"
                      aria-label={selected ? `Uncheck ${s.label}` : `Check ${s.label}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleStage(s.id, !selected);
                      }}
                    >
                      {selected ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      className="filter-dropdown-option__name"
                      onClick={() => toggleStage(s.id, !selected)}
                    >
                      {s.label} ({s.count})
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
