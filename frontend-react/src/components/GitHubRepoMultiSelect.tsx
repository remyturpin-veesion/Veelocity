import { useCallback, useEffect, useRef, useState } from 'react';
import { getGitHubOrgs, getGitHubReposSearch } from '@/api/endpoints.js';
import type { GitHubOrgItem, GitHubRepoSearchItem } from '@/types/index.js';

const DEBOUNCE_MS = 300;
const SOURCE_MY_ACCOUNT = '';

function parseRepos(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function serializeRepos(repos: string[]): string {
  return repos.join(',');
}

interface GitHubRepoMultiSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function GitHubRepoMultiSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Search repositories…',
}: GitHubRepoMultiSelectProps) {
  const selected = parseRepos(value);
  const [source, setSource] = useState<string>(SOURCE_MY_ACCOUNT);
  const [orgs, setOrgs] = useState<GitHubOrgItem[]>([]);
  const [, setOrgsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<GitHubRepoSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;
    setOrgsLoading(true);
    getGitHubOrgs()
      .then((res) => setOrgs(res.items ?? []))
      .catch(() => setOrgs([]))
      .finally(() => setOrgsLoading(false));
  }, [disabled]);

  const fetchRepos = useCallback(async (q: string, org: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGitHubReposSearch({
        q: q || undefined,
        per_page: 50,
        org: org || undefined,
      });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchRepos(searchQuery, source);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, source, fetchRepos]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addRepo = (fullName: string) => {
    if (selected.includes(fullName)) return;
    onChange(serializeRepos([...selected, fullName]));
    setSearchQuery('');
    setOpen(false);
  };

  const removeRepo = (fullName: string) => {
    onChange(serializeRepos(selected.filter((r) => r !== fullName)));
  };

  const filteredItems = items.filter((r) => !selected.includes(r.full_name));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        background: 'var(--surface)',
        borderRadius: 6,
        padding: 0,
      }}
    >
      {!disabled && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Source des dépôts
          </label>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setItems([]);
              setSearchQuery('');
              setOpen(false);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--surface-border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.875rem',
            }}
          >
            <option value={SOURCE_MY_ACCOUNT}>Mon compte</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.login}>
                Organisation : {org.login}
              </option>
            ))}
          </select>
        </div>
      )}
      {selected.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
          }}
        >
          {selected.map((fullName) => (
            <span
              key={fullName}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'var(--surface-elevated, hsl(0,0%,96%))',
                border: '1px solid var(--surface-border)',
                fontSize: '0.875rem',
                color: 'var(--text)',
              }}
            >
              {fullName}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeRepo(fullName)}
                  aria-label={`Remove ${fullName}`}
                  style={{
                    padding: 0,
                    margin: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 6,
              border: '1px solid var(--surface-border)',
              background: 'var(--surface, #fff)',
              color: 'var(--text)',
            }}
          />
          {open && (searchQuery.length > 0 || items.length > 0) && (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                maxHeight: 240,
                overflowY: 'auto',
                background: 'var(--surface-elevated, hsl(0,0%,96%))',
                border: '1px solid var(--surface-border)',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 1001,
              }}
            >
              {loading && (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Loading…
                </div>
              )}
              {error && (
                <div style={{ padding: 12, color: 'var(--error-fg)', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
              {!loading && !error && filteredItems.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {searchQuery ? 'No repositories match your search.' : 'Type to search your GitHub repositories.'}
                </div>
              )}
              {!loading &&
                filteredItems.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    role="option"
                    onClick={() => addRepo(repo.full_name)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      textAlign: 'left',
                      border: 'none',
                      background: 'none',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-hover, hsl(0,0%,94%))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {repo.full_name}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
