import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/api/endpoints.js';
import { useFiltersStore, REPO_ID_NONE } from '@/stores/filters.js';
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
  const [listOpen, setListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories({ all: true }),
  });
  const repos = (data?.items ?? []) as Repository[];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setListOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, []);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => setSearchQuery(''));
      searchInputRef.current?.focus();
    }
  }, [open]);

  const q = searchQuery.trim().toLowerCase();
  const filteredRepos = q
    ? repos.filter((r) => r.full_name.toLowerCase().includes(q))
    : repos;

  const allSelected =
    repos.length > 0 &&
    (repoIds.size === 0 || (repoIds.size === repos.length && !repoIds.has(REPO_ID_NONE)));
  const selectedRepos =
    repoIds.has(REPO_ID_NONE)
      ? []
      : repos.filter((r) => repoIds.size === 0 || repoIds.has(r.id));

  const toggleRepo = (id: number) => {
    if (repoIds.size === 0) {
      setRepoIds(repos.filter((r) => r.id !== id).map((r) => r.id));
      return;
    }
    if (repoIds.has(REPO_ID_NONE)) {
      setRepoIds([id]);
      return;
    }
    const next = new Set(repoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRepoIds(next);
  };

  const removeRepo = (id: number) => {
    if (repoIds.has(REPO_ID_NONE)) return;
    if (repoIds.size === 0) {
      setRepoIds(repos.filter((r) => r.id !== id).map((r) => r.id));
      return;
    }
    const next = new Set(repoIds);
    next.delete(id);
    setRepoIds(next.size ? next : []);
  };

  const selectOnlyRepo = (id: number) => {
    setRepoIds([id]);
    setOpen(false);
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
          <div className="filter-dropdown-search">
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search repos…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Search repositories"
            />
          </div>
          <div className="filter-dropdown-popover__scroll">
            <button
              type="button"
              role="option"
              className={`filter-dropdown-option ${allSelected ? 'filter-dropdown-option--selected' : ''}`}
              aria-selected={allSelected}
              onClick={() => {
                if (allSelected) {
                  setRepoIds(new Set([REPO_ID_NONE]));
                } else {
                  setRepoIds([]);
                }
              }}
            >
              <span className="filter-dropdown-option__check" aria-hidden>{allSelected ? '✓' : ''}</span>
              All
            </button>
            {filteredRepos.map((r) => {
            const selected =
              !repoIds.has(REPO_ID_NONE) && (repoIds.size === 0 || repoIds.has(r.id));
            return (
              <div
                key={r.id}
                role="option"
                aria-selected={selected}
                className={`filter-dropdown-option ${selected ? 'filter-dropdown-option--selected' : ''}`}
              >
                <button
                  type="button"
                  className="filter-dropdown-option__check"
                  aria-label={selected ? `Uncheck ${r.full_name}` : `Check ${r.full_name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleRepo(r.id);
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
                    selectOnlyRepo(r.id);
                  }}
                >
                  {r.full_name}
                </button>
              </div>
            );
          })}
            {filteredRepos.length === 0 && q && (
              <div className="filter-dropdown-option" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                No repos match &quot;{q}&quot;
              </div>
            )}
          </div>
        </div>
      )}
      {selectedRepos.length > 0 && !allSelected && (
        <div ref={listRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="filter-selected-badge"
            onClick={() => setListOpen((o) => !o)}
            aria-expanded={listOpen}
            aria-haspopup="dialog"
            title="View selected repositories"
          >
            {selectedRepos.length} selected
          </button>
          {listOpen && (
            <div className="filter-selected-popover" role="dialog" aria-label="Selected repositories">
              <div className="filter-selected-popover__header">
                <span className="filter-selected-popover__title">
                  Selected repositories ({selectedRepos.length})
                </span>
                <button
                  type="button"
                  className="filter-selected-popover__close"
                  onClick={() => setListOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="filter-selected-popover__list">
                {selectedRepos.map((r) => (
                  <div key={r.id} className="filter-selected-popover__item">
                    <span className="filter-selected-popover__name">{r.full_name}</span>
                    <button
                      type="button"
                      className="filter-tag-remove"
                      onClick={() => removeRepo(r.id)}
                      aria-label={`Remove ${r.full_name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
