import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/api/endpoints.js';
import { useFiltersStore } from '@/stores/filters.js';
import type { Repository } from '@/types/index.js';

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function RepoMultiSelector() {
  const repoIds = useFiltersStore((s) => s.repoIds);
  const setRepoIds = useFiltersStore((s) => s.setRepoIds);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({ queryKey: ['repositories'], queryFn: () => getRepositories() });
  const repos = (data?.items ?? []) as Repository[];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = repos.length > 0 && (repoIds.size === 0 || repoIds.size === repos.length);
  const selectedRepos = repos.filter((r) => repoIds.size === 0 || repoIds.has(r.id));

  const toggleRepo = (id: number) => {
    if (repoIds.size === 0) {
      setRepoIds(repos.filter((r) => r.id !== id).map((r) => r.id));
      return;
    }
    const next = new Set(repoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRepoIds(next);
  };

  const removeRepo = (id: number) => {
    if (repoIds.size === 0) return;
    const next = new Set(repoIds);
    next.delete(id);
    setRepoIds(next.size ? next : []);
  };

  if (isLoading) return <span className="filter-label muted">Loading repos…</span>;
  if (repos.length === 0) return null;

  const label = allSelected ? 'All' : `${selectedRepos.length} repo${selectedRepos.length !== 1 ? 's' : ''}`;

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
        <ChevronDown />
      </button>
      {open && (
        <div className="filter-dropdown-popover" role="listbox" aria-label="Select repositories">
          <button
            type="button"
            role="option"
            className={`filter-dropdown-option ${allSelected ? 'filter-dropdown-option--selected' : ''}`}
            aria-selected={allSelected}
            onClick={() => {
              setRepoIds([]);
              setOpen(false);
            }}
          >
            <span className="filter-dropdown-option__check" aria-hidden>{allSelected ? '✓' : ''}</span>
            All
          </button>
          {repos.map((r) => {
            const selected = repoIds.size === 0 || repoIds.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                className={`filter-dropdown-option ${selected ? 'filter-dropdown-option--selected' : ''}`}
                aria-selected={selected}
                onClick={() => toggleRepo(r.id)}
              >
                <span className="filter-dropdown-option__check" aria-hidden>{selected ? '✓' : ''}</span>
                {r.full_name}
              </button>
            );
          })}
        </div>
      )}
      {!allSelected && selectedRepos.length > 0 && (
        <div className="filter-tags">
          {selectedRepos.map((r) => (
            <span key={r.id} className="filter-tag">
              {r.full_name}
              <button
                type="button"
                className="filter-tag-remove"
                onClick={() => removeRepo(r.id)}
                aria-label={`Remove ${r.full_name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
