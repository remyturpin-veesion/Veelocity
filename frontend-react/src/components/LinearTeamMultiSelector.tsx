import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLinearTeams } from '@/api/endpoints.js';
import { useFiltersStore, TEAM_ID_NONE } from '@/stores/filters.js';

interface LinearTeamItem {
  id: number;
  name: string;
  key: string;
  [key: string]: unknown;
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function LinearTeamMultiSelector() {
  const teamIds = useFiltersStore((s) => s.teamIds);
  const setTeamIds = useFiltersStore((s) => s.setTeamIds);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['linear', 'teams'],
    queryFn: () => getLinearTeams({ limit: 100 }),
  });
  const teams = (data?.items ?? []) as LinearTeamItem[];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected =
    teamIds.size === 0 || (teamIds.size === teams.length && !teamIds.has(TEAM_ID_NONE));
  const selectedTeams = teamIds.has(TEAM_ID_NONE)
    ? []
    : teams.filter((t) => teamIds.size === 0 || teamIds.has(t.id));

  const toggleTeam = (id: number) => {
    if (teamIds.size === 0) {
      setTeamIds(teams.filter((t) => t.id !== id).map((t) => t.id));
      return;
    }
    if (teamIds.has(TEAM_ID_NONE)) {
      setTeamIds([id]);
      return;
    }
    const next = new Set(teamIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTeamIds(next.size ? next : []);
  };

  const removeTeam = (id: number) => {
    if (teamIds.size === 0 || teamIds.has(TEAM_ID_NONE)) return;
    const next = new Set(teamIds);
    next.delete(id);
    setTeamIds(next.size ? next : []);
  };

  if (isLoading) return <span className="filter-label muted">Loading teams…</span>;
  if (teams.length === 0) return null;

  const label = allSelected ? 'All' : `${selectedTeams.length} team${selectedTeams.length !== 1 ? 's' : ''}`;

  return (
    <div ref={containerRef} className="filter-dropdown-wrap">
      <button
        type="button"
        className="filter-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{label}</span>
        {allSelected && <span className="filter-dropdown-trigger__all-check" aria-hidden>✓</span>}
        <ChevronDown />
      </button>
      {open && (
        <div className="filter-dropdown-popover" role="listbox" aria-label="Select teams">
          <div
            role="option"
            aria-selected={allSelected}
            className={`filter-dropdown-option ${allSelected ? 'filter-dropdown-option--selected' : ''}`}
          >
            <button
              type="button"
              className="filter-dropdown-option__check"
              aria-label={allSelected ? 'Uncheck All' : 'Check All'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (allSelected) {
                  setTeamIds(new Set([TEAM_ID_NONE]));
                } else {
                  setTeamIds([]);
                }
              }}
            >
              {allSelected ? '✓' : ''}
            </button>
            <button
              type="button"
              className="filter-dropdown-option__name"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (allSelected) {
                  setTeamIds(new Set([TEAM_ID_NONE]));
                } else {
                  setTeamIds([]);
                }
              }}
            >
              All
            </button>
          </div>
          {teams.map((t) => {
            const selected =
              !teamIds.has(TEAM_ID_NONE) && (teamIds.size === 0 || teamIds.has(t.id));
            const teamLabel = `${t.name} (${t.key})`;
            return (
              <div
                key={t.id}
                role="option"
                aria-selected={selected}
                className={`filter-dropdown-option ${selected ? 'filter-dropdown-option--selected' : ''}`}
              >
                <button
                  type="button"
                  className="filter-dropdown-option__check"
                  aria-label={selected ? `Uncheck ${teamLabel}` : `Check ${teamLabel}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleTeam(t.id);
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
                    setTeamIds([t.id]);
                    setOpen(false);
                  }}
                >
                  {teamLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!allSelected && selectedTeams.length > 0 ? (
        <div className="filter-tags">
          {selectedTeams.map((t) => {
            const teamLabel = `${t.name} (${t.key})`;
            return (
              <span key={t.id} className="filter-tag">
                {teamLabel}
                <button
                  type="button"
                  className="filter-tag-remove"
                  onClick={() => removeTeam(t.id)}
                  aria-label={`Remove ${teamLabel}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
