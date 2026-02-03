import { useQuery } from '@tanstack/react-query';
import { getDevelopers } from '@/api/endpoints.js';
import { useFiltersStore } from '@/stores/filters.js';

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
      style={{
        padding: '6px 12px',
        borderRadius: 16,
        border: `1px solid var(--surface-border)`,
        background: selected ? 'var(--primary)' : 'var(--surface)',
        color: selected ? 'var(--primary-foreground)' : 'var(--text)',
        fontSize: '0.875rem',
        cursor: 'pointer',
        marginRight: 6,
      }}
    >
      {label}
    </button>
  );
}

export function DeveloperMultiSelector() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();
  const developerLogins = useFiltersStore((s) => s.developerLogins);
  const setDeveloperLogins = useFiltersStore((s) => s.setDeveloperLogins);

  const { data, isLoading } = useQuery({
    queryKey: ['developers', startDate, endDate, repoId],
    queryFn: () => getDevelopers({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });
  const developers = data?.developers ?? [];
  const allSelected = developers.length > 0 && (developerLogins.size === 0 || developerLogins.size === developers.length);

  const toggleLogin = (login: string, selected: boolean) => {
    if (developerLogins.size === 0) {
      setDeveloperLogins(selected ? [login] : developers.filter((d) => d.login !== login).map((d) => d.login));
      return;
    }
    if (selected) {
      setDeveloperLogins([...developerLogins, login]);
    } else {
      const next = new Set(developerLogins);
      next.delete(login);
      setDeveloperLogins(next);
    }
  };

  if (isLoading) return <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading developers…</span>;
  if (developers.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Chip
        label="All"
        selected={allSelected}
        onClick={() => setDeveloperLogins(allSelected && developers.length ? [developers[0]!.login] : [])}
      />
      <span style={{ width: 1, height: 20, background: 'var(--surface-border)', marginRight: 6 }} />
      {developers.slice(0, 20).map((d) => {
        const selected = developerLogins.size === 0 || developerLogins.has(d.login);
        return (
          <Chip
            key={d.login}
            label={d.login}
            selected={selected}
            onClick={() => toggleLogin(d.login, !selected)}
          />
        );
      })}
      {developers.length > 20 && (
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>+{developers.length - 20} more</span>
      )}
    </div>
  );
}
