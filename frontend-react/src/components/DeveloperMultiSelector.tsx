import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDevelopers } from '@/api/endpoints.js';
import { useFiltersStore, AUTHOR_LOGIN_NONE } from '@/stores/filters.js';

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function DeveloperMultiSelector() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();
  const developerLogins = useFiltersStore((s) => s.developerLogins);
  const setDeveloperLogins = useFiltersStore((s) => s.setDeveloperLogins);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['developers', startDate, endDate, repoId],
    queryFn: () => getDevelopers({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });
  const developers = data?.developers ?? [];

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
    developers.length > 0 &&
    (developerLogins.size === 0 ||
      (developerLogins.size === developers.length && !developerLogins.has(AUTHOR_LOGIN_NONE)));
  const selectedDevelopers = developerLogins.has(AUTHOR_LOGIN_NONE)
    ? []
    : developers.filter((d) => developerLogins.size === 0 || developerLogins.has(d.login));

  const toggleLogin = (login: string) => {
    if (developerLogins.size === 0) {
      setDeveloperLogins(developers.filter((d) => d.login !== login).map((d) => d.login));
      return;
    }
    if (developerLogins.has(AUTHOR_LOGIN_NONE)) {
      setDeveloperLogins([login]);
      return;
    }
    const next = new Set(developerLogins);
    if (next.has(login)) next.delete(login);
    else next.add(login);
    setDeveloperLogins(next);
  };

  const removeLogin = (login: string) => {
    if (developerLogins.size === 0 || developerLogins.has(AUTHOR_LOGIN_NONE)) return;
    const next = new Set(developerLogins);
    next.delete(login);
    setDeveloperLogins(next.size ? next : []);
  };

  if (isLoading) return <span className="filter-label muted">Loading developers…</span>;
  if (developers.length === 0) return null;

  const label = allSelected ? 'All' : `${selectedDevelopers.length} developer${selectedDevelopers.length !== 1 ? 's' : ''}`;

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
        <div className="filter-dropdown-popover" role="listbox" aria-label="Select developers">
          <button
            type="button"
            role="option"
            className={`filter-dropdown-option ${allSelected ? 'filter-dropdown-option--selected' : ''}`}
            aria-selected={allSelected}
            onClick={() => {
              if (allSelected) {
                setDeveloperLogins([AUTHOR_LOGIN_NONE]);
              } else {
                setDeveloperLogins([]);
              }
            }}
          >
            <span className="filter-dropdown-option__check" aria-hidden>{allSelected ? '✓' : ''}</span>
            All
          </button>
          {developers.map((d) => {
            const selected =
              !developerLogins.has(AUTHOR_LOGIN_NONE) &&
              (developerLogins.size === 0 || developerLogins.has(d.login));
            return (
              <button
                key={d.login}
                type="button"
                role="option"
                className={`filter-dropdown-option ${selected ? 'filter-dropdown-option--selected' : ''}`}
                aria-selected={selected}
                onClick={() => toggleLogin(d.login)}
              >
                <span className="filter-dropdown-option__check" aria-hidden>{selected ? '✓' : ''}</span>
                {d.login}
              </button>
            );
          })}
        </div>
      )}
      {!allSelected && selectedDevelopers.length > 0 && (
        <div className="filter-tags">
          {selectedDevelopers.map((d) => (
            <span key={d.login} className="filter-tag">
              {d.login}
              <button
                type="button"
                className="filter-tag-remove"
                onClick={() => removeLogin(d.login)}
                aria-label={`Remove ${d.login}`}
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
