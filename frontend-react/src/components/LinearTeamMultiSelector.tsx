import { useQuery } from '@tanstack/react-query';
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
      className="filter-chip"
      data-selected={selected ? '' : undefined}
    >
      {label}
    </button>
  );
}

export function LinearTeamMultiSelector() {
  const teamIds = useFiltersStore((s) => s.teamIds);
  const setTeamIds = useFiltersStore((s) => s.setTeamIds);
  const { data, isLoading } = useQuery({
    queryKey: ['linear', 'teams'],
    queryFn: () => getLinearTeams({ limit: 100 }),
  });
  const teams = (data?.items ?? []) as LinearTeamItem[];
  const allSelected = teamIds.size === 0;

  const toggleTeam = (id: number, selected: boolean) => {
    if (teamIds.size === 0) {
      setTeamIds(selected ? [id] : []);
      return;
    }
    if (selected) {
      const next = new Set(teamIds);
      next.delete(id);
      setTeamIds(next.size ? next : []);
    } else {
      setTeamIds([...teamIds, id]);
    }
  };

  if (isLoading) return <span className="filter-label muted">Loading teams…</span>;
  if (teams.length === 0) return null;

  return (
    <div className="filter-chips">
      <Chip label="All" selected={allSelected} onClick={() => setTeamIds([])} />
      {teams.map((t) => {
        const selected = teamIds.size === 0 || teamIds.has(t.id);
        const label = `${t.name} (${t.key})`;
        return (
          <Chip
            key={t.id}
            label={label}
            selected={selected}
            onClick={() => toggleTeam(t.id, !selected)}
          />
        );
      })}
    </div>
  );
}
