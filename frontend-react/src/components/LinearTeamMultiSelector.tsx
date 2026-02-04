import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { getLinearTeams } from '@/api/endpoints.js';
import { useFiltersStore } from '@/stores/filters.js';

interface LinearTeamItem {
  id: number;
  name: string;
  key: string;
  [key: string]: unknown;
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`filter-chip ${selected ? 'filter-chip--selected' : ''}`}
      aria-pressed={selected}
      aria-label={`${label}, ${selected ? 'selected' : 'not selected'}`}
    >
      {label}
    </button>
  );
}

export function LinearTeamMultiSelector() {
  const teamIdsArray = useFiltersStore(useShallow((s) => Array.from(s.teamIds)));
  const setTeamIds = useFiltersStore((s) => s.setTeamIds);
  const { data, isLoading } = useQuery({
    queryKey: ['linear', 'teams'],
    queryFn: () => getLinearTeams({ limit: 100 }),
  });
  const teams = (data?.items ?? []) as LinearTeamItem[];
  const allSelected = teams.length > 0 && teamIdsArray.length === teams.length;
  const teamIdsSet = new Set(teamIdsArray);

  const toggleTeam = (id: number, currentlySelected: boolean) => {
    if (teamIdsArray.length === 0) {
      setTeamIds(currentlySelected ? [] : [id]);
      return;
    }
    if (currentlySelected) {
      const next = teamIdsArray.filter((x) => x !== id);
      setTeamIds(next.length ? next : []);
    } else {
      setTeamIds([...teamIdsArray, id]);
    }
  };

  if (isLoading) return <span className="filter-label muted">Loading teams…</span>;
  if (teams.length === 0) return null;

  return (
    <div className="filter-chips">
      <Chip
        label="All"
        selected={allSelected}
        onClick={() => {
          setTeamIds(allSelected ? [] : teams.map((t) => t.id));
        }}
      />
      {teams.map((t) => {
        const selected = teamIdsSet.has(t.id);
        const label = `${t.name} (${t.key})`;
        return (
          <Chip
            key={t.id}
            label={label}
            selected={selected}
            onClick={() => toggleTeam(t.id, selected)}
          />
        );
      })}
    </div>
  );
}
