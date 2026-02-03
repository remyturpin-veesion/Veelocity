import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/api/endpoints.js';
import { useFiltersStore } from '@/stores/filters.js';
import type { Repository } from '@/types/index.js';

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

function shortName(fullName: string): string {
  return fullName.includes('/') ? fullName.split('/').pop()! : fullName;
}

export function RepoMultiSelector() {
  const repoIds = useFiltersStore((s) => s.repoIds);
  const setRepoIds = useFiltersStore((s) => s.setRepoIds);
  const { data, isLoading } = useQuery({ queryKey: ['repositories'], queryFn: () => getRepositories() });
  const repos = (data?.items ?? []) as Repository[];
  const allSelected = repos.length > 0 && (repoIds.size === 0 || repoIds.size === repos.length);

  const toggleRepo = (id: number, selected: boolean) => {
    if (repoIds.size === 0) {
      setRepoIds(selected ? [id] : repos.filter((r) => r.id !== id).map((r) => r.id));
      return;
    }
    if (selected) {
      setRepoIds([...repoIds, id]);
    } else {
      const next = new Set(repoIds);
      next.delete(id);
      setRepoIds(next);
    }
  };

  if (isLoading) return <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading repos…</span>;
  if (repos.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Chip
        label="All"
        selected={allSelected}
        onClick={() => setRepoIds(allSelected && repos.length ? [repos[0]!.id] : [])}
      />
      <span style={{ width: 1, height: 20, background: 'var(--surface-border)', marginRight: 6 }} />
      {repos.map((r) => {
        const selected = repoIds.size === 0 || repoIds.has(r.id);
        return (
          <Chip
            key={r.id}
            label={shortName(r.full_name)}
            selected={selected}
            onClick={() => toggleRepo(r.id, !selected)}
          />
        );
      })}
    </div>
  );
}
