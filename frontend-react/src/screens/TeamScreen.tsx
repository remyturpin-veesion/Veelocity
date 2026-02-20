import { Fragment, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Select, { type StylesConfig } from 'react-select';
import { useFiltersStore, AUTHOR_LOGIN_NONE } from '@/stores/filters.js';
import {
  getDevelopers,
  getDeveloperStats,
  getLinearAssignees,
  getDeveloperLinearLinks,
  setDeveloperLinearAssignee,
} from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import type { Developer } from '@/types/index.js';

const NONE_LABEL = '— None —';

type Option = { value: string; label: string };

/** Searchable dropdown for Linear assignee selection (react-select; menu portaled for correct positioning). */
function LinearAssigneeSelect({
  assignees,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  assignees: string[];
  value: string;
  onChange: (linear_assignee_name: string | null) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  const options = useMemo<Option[]>(
    () => [{ value: '', label: NONE_LABEL }, ...assignees.map((name) => ({ value: name, label: name }))],
    [assignees]
  );
  const selectedOption: Option | null = value
    ? { value, label: value }
    : { value: '', label: NONE_LABEL };

  const selectStyles: StylesConfig<Option> = {
    control: (base, state) => ({
      ...base,
      minHeight: 32,
      backgroundColor: 'var(--surface)',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--surface-border)',
      '&:hover': { borderColor: 'var(--primary)' },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--surface-border)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
        : state.isSelected
          ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
          : 'transparent',
      color: 'var(--text)',
    }),
    singleValue: (base) => ({ ...base, color: 'var(--text)' }),
    input: (base) => ({ ...base, color: 'var(--text)' }),
  };

  return (
    <div className="team-table__linear-dropdown" onClick={(e) => e.stopPropagation()}>
      <Select<Option>
        options={options}
        value={selectedOption}
        onChange={(opt: Option | null) => onChange(opt && opt.value !== '' ? opt.value : null)}
        isSearchable
        isDisabled={disabled}
        aria-label={ariaLabel}
        placeholder={NONE_LABEL}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
        menuPlacement="auto"
        classNamePrefix="team-linear-select"
        styles={selectStyles}
      />
    </div>
  );
}

function getInitials(login: string): string {
  return login
    .split(/[-_.]/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Inline detail panel that fetches full stats on mount. */
function DeveloperDetail({ login, startDate, endDate, repoId }: {
  login: string;
  startDate: string;
  endDate: string;
  repoId: number | undefined;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', login, startDate, endDate, repoId],
    queryFn: () => getDeveloperStats(login, { start_date: startDate, end_date: endDate, repo_id: repoId }),
  });

  if (isLoading) {
    return <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading stats…</div>;
  }
  if (error) {
    return <div style={{ padding: '8px 0', color: 'var(--metric-orange)', fontSize: '0.875rem' }}>Failed to load stats</div>;
  }
  if (!data) return null;

  return (
    <div className="team-accordion__stats-grid">
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">PRs created</span>
        <span className="team-accordion__stat-value">{data.prs_created}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">PRs merged</span>
        <span className="team-accordion__stat-value">{data.prs_merged}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">PRs open</span>
        <span className="team-accordion__stat-value">{data.prs_open}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Reviews given</span>
        <span className="team-accordion__stat-value">{data.reviews_given}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Comments</span>
        <span className="team-accordion__stat-value">{data.comments_made}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Commits</span>
        <span className="team-accordion__stat-value">{data.commits_made}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Lines added</span>
        <span className="team-accordion__stat-value">+{data.total_additions.toLocaleString()}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Lines deleted</span>
        <span className="team-accordion__stat-value">-{data.total_deletions.toLocaleString()}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Avg lines / PR</span>
        <span className="team-accordion__stat-value">{data.avg_lines_per_pr.toLocaleString()}</span>
      </div>
      <div className="team-accordion__stat">
        <span className="team-accordion__stat-label">Avg merge time</span>
        <span className="team-accordion__stat-value">{data.avg_merge_hours.toFixed(1)} h</span>
      </div>
    </div>
  );
}

type SortKey = 'login' | 'prs_created' | 'prs_merged' | 'reviews_given' | 'comments_made';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`team-table__sort-icon${active ? ' team-table__sort-icon--active' : ''}`}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );
}

export function TeamScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const developerLogins = useFiltersStore((s) => s.developerLogins);
  const { startDate, endDate } = getStartEnd();

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['developers', startDate, endDate, repoId],
    queryFn: () => getDevelopers({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });
  const { data: assigneesData } = useQuery({
    queryKey: ['developers', 'linear-assignees'],
    queryFn: getLinearAssignees,
  });
  const { data: linksData } = useQuery({
    queryKey: ['developers', 'linear-links'],
    queryFn: getDeveloperLinearLinks,
  });
  const setLinkMutation = useMutation({
    mutationFn: ({ login, linear_assignee_name }: { login: string; linear_assignee_name: string | null }) =>
      setDeveloperLinearAssignee(login, { linear_assignee_name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developers', 'linear-links'] });
    },
  });

  const assignees = useMemo(() => assigneesData?.assignees ?? [], [assigneesData?.assignees]);
  const linkByLogin = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of linksData?.links ?? []) {
      m[l.developer_login] = l.linear_assignee_name;
    }
    return m;
  }, [linksData?.links]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('prs_merged');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const developers = useMemo<Developer[]>(() => data?.developers ?? [], [data?.developers]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const toggleRow = (login: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = [...developers];
    // Apply dev team / developer logins filter
    if (developerLogins.size > 0 && !developerLogins.has(AUTHOR_LOGIN_NONE)) {
      list = list.filter((d) => developerLogins.has(d.login));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.login.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortKey === 'login') {
        return sortDir === 'asc'
          ? a.login.localeCompare(b.login)
          : b.login.localeCompare(a.login);
      }
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [developers, developerLogins, search, sortKey, sortDir]);

  if (isLoading) return <div className="loading">Loading developers…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  return (
    <div className="team-page">
      <h1 className="screen-title">Team</h1>
      <PageSummary>
        Per-developer metrics and activity · {startDate} – {endDate} · Filtered by repos and developers
      </PageSummary>

      {/* KPI row */}
      <div className="dashboard__kpi-row" data-tour="team-list" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KpiCard title="Developers" value={String(filtered.length)} icon="👥" />
        <KpiCard title="PRs merged" value={String(filtered.reduce((s, d) => s + d.prs_merged, 0))} icon="🔀" />
        <KpiCard title="Reviews given" value={String(filtered.reduce((s, d) => s + d.reviews_given, 0))} icon="👀" />
      </div>

      {developers.length === 0 ? (
        <EmptyState title="No developers" message="No developer activity found in this period. Try expanding the date range or check that GitHub is connected." />
      ) : (
        <>
          <div className="team-table__toolbar">
            <input
              type="search"
              className="team-table__search"
              placeholder="Search developers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="team-table__count">
              {filtered.length} developer{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="team-table__wrapper">
            <table className="team-table">
              <thead>
                <tr>
                  <th className="team-table__th team-table__th--developer">
                    <button type="button" className="team-table__sort-btn" onClick={() => handleSort('login')}>
                      Developer
                      <SortIcon active={sortKey === 'login'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="team-table__th team-table__th--num">
                    <button type="button" className="team-table__sort-btn" onClick={() => handleSort('prs_created')}>
                      PRs Created
                      <SortIcon active={sortKey === 'prs_created'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="team-table__th team-table__th--num">
                    <button type="button" className="team-table__sort-btn" onClick={() => handleSort('prs_merged')}>
                      PRs Merged
                      <SortIcon active={sortKey === 'prs_merged'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="team-table__th team-table__th--num">
                    <button type="button" className="team-table__sort-btn" onClick={() => handleSort('reviews_given')}>
                      Reviews
                      <SortIcon active={sortKey === 'reviews_given'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="team-table__th team-table__th--num">
                    <button type="button" className="team-table__sort-btn" onClick={() => handleSort('comments_made')}>
                      Comments
                      <SortIcon active={sortKey === 'comments_made'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="team-table__th team-table__th--linear">Linear assignee</th>
                  <th className="team-table__th team-table__th--expand" aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const isOpen = expandedIds.has(d.login);
                  return (
                    <Fragment key={d.login}>
                      <tr
                        className={`team-table__row${isOpen ? ' team-table__row--open' : ''}`}
                        onClick={() => toggleRow(d.login)}
                        aria-expanded={isOpen}
                      >
                        <td className="team-table__td team-table__td--developer">
                          {d.avatar ? (
                            <img src={d.avatar} alt="" className="team-table__avatar" />
                          ) : (
                            <span className="team-table__avatar-placeholder">{getInitials(d.login)}</span>
                          )}
                          <span className="team-table__login">{d.login}</span>
                        </td>
                        <td className="team-table__td team-table__td--num">{d.prs_created}</td>
                        <td className="team-table__td team-table__td--num">{d.prs_merged}</td>
                        <td className="team-table__td team-table__td--num">{d.reviews_given}</td>
                        <td className="team-table__td team-table__td--num">{d.comments_made}</td>
                        <td
                          className="team-table__td team-table__td--linear"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <LinearAssigneeSelect
                            assignees={assignees}
                            value={linkByLogin[d.login] ?? ''}
                            onChange={(linear_assignee_name) =>
                              setLinkMutation.mutate({
                                login: d.login,
                                linear_assignee_name,
                              })
                            }
                            disabled={setLinkMutation.isPending}
                            ariaLabel={`Linear assignee for ${d.login}`}
                          />
                        </td>
                        <td className="team-table__td team-table__td--expand">
                          <span className={`team-table__chevron${isOpen ? ' team-table__chevron--open' : ''}`} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="team-table__detail-row">
                          <td colSpan={7} className="team-table__detail-cell">
                            <DeveloperDetail
                              login={d.login}
                              startDate={startDate}
                              endDate={endDate}
                              repoId={repoId ?? undefined}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
