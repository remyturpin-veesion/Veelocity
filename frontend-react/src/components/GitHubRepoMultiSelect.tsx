import { useCallback, useEffect, useRef, useState } from 'react';
import { getGitHubOrgs, getGitHubReposSearch } from '@/api/endpoints.js';
import type { GitHubOrgItem, GitHubRepoSearchItem } from '@/types/index.js';

const DEBOUNCE_MS = 300;
const SOURCE_MY_ACCOUNT = '';
const ORG_PREFIX = 'org:';

/** Parse a mixed value string into org subscriptions and individual repos. */
function parseEntries(value: string): { orgs: string[]; repos: string[] } {
  const orgs: string[] = [];
  const repos: string[] = [];
  if (!value.trim()) return { orgs, repos };
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(ORG_PREFIX)) {
      const name = trimmed.slice(ORG_PREFIX.length).trim();
      if (name) orgs.push(name);
    } else {
      repos.push(trimmed);
    }
  }
  return { orgs, repos };
}

/** Serialize orgs + repos back to a comma-separated string. */
function serializeEntries(orgs: string[], repos: string[]): string {
  const parts: string[] = [];
  for (const o of orgs) parts.push(`${ORG_PREFIX}${o}`);
  for (const r of repos) parts.push(r);
  return parts.join(',');
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
  const { orgs: selectedOrgs, repos: selectedRepos } = parseEntries(value);
  const [source, setSource] = useState<string>(SOURCE_MY_ACCOUNT);
  const [orgsList, setOrgsList] = useState<GitHubOrgItem[]>([]);
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
      .then((res) => setOrgsList(res.items ?? []))
      .catch(() => setOrgsList([]))
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

  /** Check if a repo belongs to a subscribed org. */
  const isRepoFromSubscribedOrg = (fullName: string) => {
    const owner = fullName.split('/')[0]?.toLowerCase() ?? '';
    return selectedOrgs.some((o) => o.toLowerCase() === owner);
  };

  const addRepo = (fullName: string) => {
    if (selectedRepos.includes(fullName)) return;
    // Don't add individual repo if its org is already subscribed
    if (isRepoFromSubscribedOrg(fullName)) return;
    onChange(serializeEntries(selectedOrgs, [...selectedRepos, fullName]));
    setSearchQuery('');
    setOpen(false);
  };

  const removeRepo = (fullName: string) => {
    onChange(serializeEntries(selectedOrgs, selectedRepos.filter((r) => r !== fullName)));
  };

  const addOrg = (orgLogin: string) => {
    if (selectedOrgs.some((o) => o.toLowerCase() === orgLogin.toLowerCase())) return;
    // Remove individual repos that belong to the newly-subscribed org
    const filteredRepos = selectedRepos.filter(
      (r) => (r.split('/')[0] ?? '').toLowerCase() !== orgLogin.toLowerCase()
    );
    onChange(serializeEntries([...selectedOrgs, orgLogin], filteredRepos));
  };

  const removeOrg = (orgLogin: string) => {
    onChange(
      serializeEntries(
        selectedOrgs.filter((o) => o.toLowerCase() !== orgLogin.toLowerCase()),
        selectedRepos
      )
    );
  };

  /** Is the currently-selected source already subscribed as an org? */
  const currentSourceIsSubscribedOrg =
    source !== SOURCE_MY_ACCOUNT &&
    selectedOrgs.some((o) => o.toLowerCase() === source.toLowerCase());

  // Filter dropdown items: hide already-selected repos and repos from subscribed orgs
  const filteredItems = items.filter(
    (r) => !selectedRepos.includes(r.full_name) && !isRepoFromSubscribedOrg(r.full_name)
  );

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
            Repository source
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setItems([]);
                setSearchQuery('');
                setOpen(false);
              }}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--surface-border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
              }}
            >
              <option value={SOURCE_MY_ACCOUNT}>My account</option>
              {orgsList.map((org) => (
                <option key={org.id} value={org.login}>
                  Organization: {org.login}
                </option>
              ))}
            </select>
            {source !== SOURCE_MY_ACCOUNT && !currentSourceIsSubscribedOrg && (
              <button
                type="button"
                onClick={() => addOrg(source)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--primary, #3b82f6)',
                  background: 'var(--primary, #3b82f6)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Import all repos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Org subscription chips */}
      {selectedOrgs.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
          }}
        >
          {selectedOrgs.map((orgName) => (
            <span
              key={`org:${orgName}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--primary-bg, rgba(59, 130, 246, 0.12))',
                border: '1px solid var(--primary-border, rgba(59, 130, 246, 0.35))',
                fontSize: '0.875rem',
                color: 'var(--primary-fg, #3b82f6)',
                fontWeight: 500,
              }}
            >
              {orgName}
              <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: 2 }}>(all repos)</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeOrg(orgName)}
                  aria-label={`Remove organization ${orgName}`}
                  style={{
                    padding: 0,
                    margin: 0,
                    marginLeft: 2,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--primary-fg, #3b82f6)',
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

      {/* Individual repo chips */}
      {selectedRepos.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
          }}
        >
          {selectedRepos.map((fullName) => (
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

      {/* Search input + dropdown */}
      {!disabled && !currentSourceIsSubscribedOrg && (
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

      {/* Hint when the current source org is fully subscribed */}
      {!disabled && currentSourceIsSubscribedOrg && (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          All repositories from <strong>{source}</strong> are imported. Remove the organization above to pick individual repos instead.
        </p>
      )}
    </div>
  );
}
