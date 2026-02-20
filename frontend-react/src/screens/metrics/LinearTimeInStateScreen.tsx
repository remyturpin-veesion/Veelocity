import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay, TEAM_ID_NONE } from '@/stores/filters.js';
import { getLinearTimeInState } from '@/api/endpoints.js';
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
  median_hours?: number;
  min_hours?: number;
  max_hours?: number;
  [key: string]: unknown;
}

export function LinearTimeInStateScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  useFiltersStore((s) => s.teamIds);
  useFiltersStore((s) => s.developerLogins);
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const getDeveloperLoginsForApi = useFiltersStore((s) => s.getDeveloperLoginsForApi);
  const teamIdsParam = getTeamIdsForApi();
  const developerLoginsParam = getDeveloperLoginsForApi();
  const timeInStateStageIds = useFiltersStore((s) => s.timeInStateStageIds);
  const setTimeInStateStageIds = useFiltersStore((s) => s.setTimeInStateStageIds);
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'linear', 'time-in-state', startDate, endDate, teamIdsParam, developerLoginsParam],
    queryFn: () =>
      getLinearTimeInState({
        start_date: startDate,
        end_date: endDate,
        team_ids:
          teamIdsParam && teamIdsParam.length > 0 && !(teamIdsParam.length === 1 && teamIdsParam[0] === TEAM_ID_NONE)
            ? teamIdsParam.filter((id) => id !== TEAM_ID_NONE)
            : undefined,
        no_teams: teamIdsParam?.length === 1 && teamIdsParam[0] === TEAM_ID_NONE,
        developer_logins: developerLoginsParam,
      }),
  });

  const stagesDropdownRef = useRef<HTMLDivElement>(null);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [stageSearchQuery, setStageSearchQuery] = useState('');
  const stageSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stagesDropdownRef.current && !stagesDropdownRef.current.contains(e.target as Node)) {
        setStagesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, []);

  useEffect(() => {
    if (stagesOpen) {
      queueMicrotask(() => setStageSearchQuery(''));
      stageSearchInputRef.current?.focus();
    }
  }, [stagesOpen]);

  if (isLoading) {
    return (
      <div>
        <div className="screen-title-row"><h1 className="screen-title">Linear time in state</h1><MetricInfoButton metricKey="linear-time-in-state" /></div>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
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

  const stageSearchQ = stageSearchQuery.trim().toLowerCase();
  const filteredStages =
    stageSearchQ
      ? allStages.filter((s) => s.label.toLowerCase().includes(stageSearchQ) || s.id.toLowerCase().includes(stageSearchQ))
      : allStages;

  return (
    <div>
      <div className="screen-title-row"><h1 className="screen-title">Linear time in state</h1><MetricInfoButton metricKey="linear-time-in-state" /></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)} — time in each status for issues completed in the period (from Linear state history when synced).
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
            {allStagesSelected && <span className="filter-dropdown-trigger__all-check" aria-hidden>✓</span>}
            <ChevronDown />
          </button>
          {stagesOpen && (
            <div className="filter-dropdown-popover" role="listbox" aria-label="Select stages" style={{ minWidth: 220 }}>
              <div className="filter-dropdown-search">
                <input
                  ref={stageSearchInputRef}
                  type="search"
                  placeholder="Search stages…"
                  value={stageSearchQuery}
                  onChange={(e) => setStageSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label="Search stages"
                />
              </div>
              <div className="filter-dropdown-popover__scroll">
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
                {filteredStages.map((s) => {
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTimeInStateStageIds([s.id]);
                        setStagesOpen(false);
                      }}
                    >
                      {s.label} ({s.count})
                    </button>
                  </div>
                );
              })}
                {filteredStages.length === 0 && stageSearchQ && (
                  <div className="filter-dropdown-option" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                    No stages match &quot;{stageSearchQ}&quot;
                  </div>
                )}
              </div>
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
          {visibleStages.map((s) => {
            const hasTime = s.average_hours != null && s.average_hours > 0;
            const medianH = s.median_hours ?? 0;
            const subtitle =
              s.count != null
                ? medianH > 0
                  ? `median ${medianH < 24 ? `${medianH.toFixed(1)} h` : `${(medianH / 24).toFixed(1)} d`} · ${s.count} issues`
                  : `${s.count} issues`
                : undefined;
            return (
              <KpiCard
                key={s.id}
                title={s.label}
                value={hasTime ? `${s.average_hours!.toFixed(1)} h` : '—'}
                subtitle={subtitle}
              />
            );
          })}
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
