import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.js';
import { useThemeStore } from '@/stores/theme.js';
import { useTourStore } from '@/stores/tour.js';
import { useFiltersStore, formatDateRangeDisplay, getSprintNumber, getSprintDates } from '@/stores/filters.js';
import { useDeveloperTeamsStore } from '@/stores/developerTeams.js';
import type { DeveloperTeam } from '@/stores/developerTeams.js';
import { RepoMultiSelector } from '@/components/RepoMultiSelector.js';
import { LinearTeamMultiSelector } from '@/components/LinearTeamMultiSelector.js';
import { SettingsDialog } from '@/components/SettingsDialog.js';
import { UserManagementDialog } from '@/components/UserManagementDialog.js';
import {
  getDevelopers,
  getDeveloperTeams,
  createDeveloperTeam,
  updateDeveloperTeam,
  deleteDeveloperTeam,
} from '@/api/endpoints.js';
import type { TimePeriodKey } from '@/stores/filters.js';

const DEVELOPER_TEAMS_QUERY_KEY = ['developer-teams'];

const TABS = [
  { path: '/', label: 'Dashboard' },
  { path: '/dora', label: 'DORA' },
  { path: '/github', label: 'GitHub' },
  { path: '/linear', label: 'Linear' },
  { path: '/cursor', label: 'Cursor' },
  { path: '/greptile', label: 'Greptile' },
  { path: '/sentry', label: 'Sentry' },
  { path: '/team', label: 'Team' },
  { path: '/data-coverage', label: 'Data coverage' },
] as const;

/** Sidebar sublinks when on GitHub: Overview + Synced + DORA + Code Review + Dev + Insights */
const GITHUB_SIDEBAR = {
  overview: { path: '/github', icon: '⊞', label: 'Overview' },
  synced: { path: '/github/synced', icon: '✓', label: 'Synced' },
  dora: [
    { path: '/metrics/deployment-frequency', icon: '🚀', label: 'Deployment frequency' },
    { path: '/metrics/lead-time', icon: '⏱', label: 'Lead time' },
  ],
  codeReview: [
    { path: '/github/pull-request', icon: '📋', label: 'Metrics' },
    { path: '/github/code-review/prs', icon: '📄', label: 'PRs' },
  ],
  dev: [
    { path: '/metrics/throughput', icon: '📦', label: 'Throughput' },
    { path: '/metrics/cycle-time', icon: '🔄', label: 'Cycle time' },
  ],
  insights: [
    { path: '/insights/recommendations', icon: '🛡', label: 'Recommendations' },
    { path: '/insights/correlations', icon: '📈', label: 'Correlations' },
  ],
} as const;

const DORA_SIDEBAR_LINKS = [
  { path: '/dora', icon: '⊞', label: 'Overview' },
  { path: '/dora/benchmarks', icon: '📊', label: 'Benchmarks' },
  { path: '/dora/metrics', icon: '📋', label: 'Metrics report' },
] as const;

const LINEAR_SIDEBAR_LINKS = [
  { path: '/linear', icon: '⊞', title: 'Overview' },
  { path: '/metrics/linear/issues-completed', icon: '✓', title: 'Issues completed' },
  { path: '/metrics/linear/backlog', icon: '▢', title: 'Backlog' },
  { path: '/metrics/linear/time-in-state', icon: '◷', title: 'Time in state' },
] as const;

const GREPTILE_SIDEBAR_LINKS = [
  { path: '/greptile', icon: '⊞', label: 'Overview' },
  { path: '/greptile/indexing', icon: '🗂', label: 'Repository indexing' },
  { path: '/greptile/recommendations', icon: '🛡', label: 'Recommendations' },
] as const;

const SENTRY_SIDEBAR_LINKS = [
  { path: '/sentry', icon: '⊞', label: 'Overview' },
  { path: '/sentry/projects', icon: '📦', label: 'Projects' },
  { path: '/sentry/trends', icon: '📈', label: 'Trends' },
] as const;

function isActive(path: string, current: string): boolean {
  if (path === '/') return current === '/' || current === '/dashboard';
  return current === path || current.startsWith(path + '/');
}

function isDoraRoute(pathname: string): boolean {
  return pathname === '/dora' || pathname.startsWith('/dora/');
}

function isLinearRoute(pathname: string): boolean {
  return pathname === '/linear' || pathname.startsWith('/metrics/linear');
}

function isGreptileRoute(pathname: string): boolean {
  return pathname === '/greptile' || pathname.startsWith('/greptile/');
}

function isSentryRoute(pathname: string): boolean {
  return pathname === '/sentry' || pathname.startsWith('/sentry/');
}

function isGitHubRoute(pathname: string): boolean {
  return (
    pathname === '/github' ||
    pathname.startsWith('/github/') ||
    (pathname.startsWith('/metrics/') && !pathname.startsWith('/metrics/linear')) ||
    pathname.startsWith('/insights/')
  );
}

function isTeamRoute(pathname: string): boolean {
  return pathname === '/team' || pathname.startsWith('/team/');
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const hasCompletedTour = useTourStore((s) => s.hasCompletedTour);
  const startTour = useTourStore((s) => s.startTour);
  const dateRange = useFiltersStore((s) => s.dateRange);
  const setDateRangePreset = useFiltersStore((s) => s.setDateRangePreset);
  const setDateRangeCustom = useFiltersStore((s) => s.setDateRangeCustom);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const activeSprint = useFiltersStore((s) => s.activeSprint);
  const setActiveSprint = useFiltersStore((s) => s.setActiveSprint);
  const { startDate, endDate } = getStartEnd();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [sprintPickerOpen, setSprintPickerOpen] = useState(false);
  const sprintPickerRef = useRef<HTMLDivElement>(null);
  const showDoraSidebar = isDoraRoute(location.pathname);
  const showLinearSidebar = isLinearRoute(location.pathname);
  const showGitHubSidebar = isGitHubRoute(location.pathname);
  const showGreptileSidebar = isGreptileRoute(location.pathname);
  const showSentrySidebar = isSentryRoute(location.pathname);
  const showTeamSidebar = isTeamRoute(location.pathname);

  useEffect(() => {
    if (!datePickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [datePickerOpen]);

  useEffect(() => {
    if (!sprintPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (sprintPickerRef.current && !sprintPickerRef.current.contains(e.target as Node)) {
        setSprintPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [sprintPickerOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [userMenuOpen]);

  useEffect(() => {
    if (hasCompletedTour) return;
    const timer = setTimeout(() => startTour(), 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <UserManagementDialog open={userManagementOpen} onClose={() => setUserManagementOpen(false)} />
      <div className="app-shell__sticky-header">
      <header className="app-shell__top">
        <Link to="/" className="app-shell__logo" aria-label="Veelocity home">
          <img src="/Veelocity.png" alt="Veelocity" className="app-shell__logo-img" />
        </Link>
        <nav className="app-shell__nav" data-tour="nav-tabs">
          {TABS.map(({ path, label }) => {
            const active =
              path === '/dora'
                ? showDoraSidebar
                : path === '/github'
                  ? showGitHubSidebar
                  : path === '/linear'
                    ? showLinearSidebar
                    : path === '/greptile'
                      ? showGreptileSidebar
                      : path === '/sentry'
                        ? showSentrySidebar
                        : isActive(path, location.pathname);
            return (
              <Link
                key={path}
                to={path}
                className={active ? 'active' : ''}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="app-shell__spacer" />
        <button
          type="button"
          className="app-shell__icon-btn"
          onClick={() => startTour()}
          title="Guided tour"
          aria-label="Start guided tour"
          data-tour="tour-button"
        >
          🧭
        </button>
        <button
          type="button"
          className="app-shell__icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          type="button"
          className="app-shell__icon-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
          data-tour="settings-button"
        >
          ⚙️
        </button>
        <div className="app-shell__user-menu-wrap" ref={userMenuRef}>
          <button
            type="button"
            className="app-shell__user-email-btn"
            onClick={() => setUserMenuOpen((o) => !o)}
            title={user?.email ?? ''}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            {user?.email ?? ''}
          </button>
          {userMenuOpen && (
            <div className="app-shell__user-dropdown">
              <button
                type="button"
                className="app-shell__user-dropdown-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  setUserManagementOpen(true);
                }}
              >
                User management
              </button>
              <button
                type="button"
                className="app-shell__user-dropdown-item"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      {location.pathname !== '/data-coverage' && (
        <div className="app-shell__filters" data-tour="global-filters">
          <div className="app-shell__filters-inner">
            <div className="app-shell__filters-left">
              {!showLinearSidebar && (
                <div className="app-shell__filter-row">
                  <span className="app-shell__filter-label">Repos</span>
                  <RepoMultiSelector />
                </div>
              )}
              {showLinearSidebar && (
                <div className="app-shell__filter-row">
                  <span className="app-shell__filter-label">Teams</span>
                  <LinearTeamMultiSelector />
                </div>
              )}
              <DevTeamSelect />
            </div>
            <div className="app-shell__filters-right">
            <div className="app-shell__date-range-wrap" ref={sprintPickerRef}>
              <button
                type="button"
                className={`app-shell__date-pill${activeSprint !== null ? ' app-shell__date-pill--sprint-active' : ''}`}
                title="Choose sprint"
                onClick={() => {
                  setSprintPickerOpen((o) => !o);
                  setDatePickerOpen(false);
                }}
                aria-expanded={sprintPickerOpen}
                aria-haspopup="dialog"
              >
                {activeSprint !== null ? `Sprint ${activeSprint}` : 'Sprint'} ▾
              </button>
              {sprintPickerOpen && (
                <div className="app-shell__date-popover app-shell__sprint-popover" role="dialog" aria-label="Sprint">
                  <SprintPickerList
                    activeSprint={activeSprint}
                    onSelect={(n) => {
                      const { startDate: s, endDate: e } = getSprintDates(n);
                      setDateRangeCustom(s, e);
                      setActiveSprint(n);
                      setSprintPickerOpen(false);
                    }}
                  />
                  {activeSprint !== null && (
                    <div className="app-shell__sprint-clear">
                      <button
                        type="button"
                        className="app-shell__sprint-clear-btn"
                        onClick={() => {
                          setActiveSprint(null);
                          setSprintPickerOpen(false);
                        }}
                      >
                        Clear sprint
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="app-shell__date-range-wrap" ref={datePickerRef}>
              <button
                type="button"
                className="app-shell__date-pill"
                title="Choose date range"
                onClick={() => {
                  setDatePickerOpen((o) => !o);
                  setSprintPickerOpen(false);
                }}
                aria-expanded={datePickerOpen}
                aria-haspopup="dialog"
              >
                {formatDateRangeDisplay(startDate, endDate)}
              </button>
              {datePickerOpen && (
                <div className="app-shell__date-popover" role="dialog" aria-label="Date range">
                  <PeriodSelector
                    preset={dateRange.preset}
                    onPresetChange={(p) => {
                      setDateRangePreset(p);
                      setActiveSprint(null);
                      setDatePickerOpen(false);
                    }}
                  />
                  <div className="app-shell__date-custom">
                    <span className="app-shell__date-custom-label">Custom range</span>
                    <div className="app-shell__date-custom-inputs">
                      <label className="app-shell__date-custom-field">
                        <span>From</span>
                        <input
                          type="date"
                          value={dateRange.customStart ?? startDate}
                          onChange={(e) => {
                            const start = e.target.value;
                            const end = dateRange.customEnd ?? endDate;
                            setDateRangeCustom(start, end && start <= end ? end : start);
                            setActiveSprint(null);
                          }}
                        />
                      </label>
                      <label className="app-shell__date-custom-field">
                        <span>To</span>
                        <input
                          type="date"
                          value={dateRange.customEnd ?? endDate}
                          onChange={(e) => {
                            const end = e.target.value;
                            const start = dateRange.customStart ?? startDate;
                            setDateRangeCustom(start && start <= end ? start : end, end);
                            setActiveSprint(null);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
      </div>
      {showDoraSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="DORA section" data-tour="dora-sidebar">
            {DORA_SIDEBAR_LINKS.map(({ path, icon, label }) => {
              const active = path === '/dora'
                ? location.pathname === '/dora'
                : isActive(path, location.pathname);
              return (
                <Link
                  key={path}
                  to={path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : showGitHubSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="GitHub section" data-tour="github-sidebar">
            <Link
              to="/github"
              className={isActive('/github', location.pathname) && location.pathname === '/github' ? 'active' : ''}
              aria-current={location.pathname === '/github' ? 'page' : undefined}
            >
              <span className="app-shell__sidebar-icon">{GITHUB_SIDEBAR.overview.icon}</span>
              <span className="app-shell__sidebar-label">{GITHUB_SIDEBAR.overview.label}</span>
            </Link>
            <span className="app-shell__sidebar-section">DORA</span>
            {GITHUB_SIDEBAR.dora.map(({ path, icon, label }) => {
              const active = isActive(path, location.pathname);
              return (
                <Link key={path} to={path} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
            <span className="app-shell__sidebar-section">Code Review</span>
            {GITHUB_SIDEBAR.codeReview.map(({ path, icon, label }) => {
              const active = isActive(path, location.pathname);
              return (
                <Link key={path} to={path} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
            <span className="app-shell__sidebar-section">Dev</span>
            {GITHUB_SIDEBAR.dev.map(({ path, icon, label }) => {
              const active = isActive(path, location.pathname);
              return (
                <Link key={path} to={path} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
            <span className="app-shell__sidebar-section">Insights</span>
            {GITHUB_SIDEBAR.insights.map(({ path, icon, label }) => {
              const active = isActive(path, location.pathname);
              return (
                <Link key={path} to={path} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
            <Link
              to={GITHUB_SIDEBAR.synced.path}
              className={location.pathname === '/github/synced' ? 'active' : ''}
              aria-current={location.pathname === '/github/synced' ? 'page' : undefined}
            >
              <span className="app-shell__sidebar-icon">{GITHUB_SIDEBAR.synced.icon}</span>
              <span className="app-shell__sidebar-label">{GITHUB_SIDEBAR.synced.label}</span>
            </Link>
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : showLinearSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="Linear section" data-tour="linear-sidebar">
            {LINEAR_SIDEBAR_LINKS.map(({ path, icon, title }) => {
              const active = isActive(path, location.pathname);
              return (
                <Link
                  key={path}
                  to={path}
                  className={active ? 'active' : ''}
                  title={title}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{title}</span>
                </Link>
              );
            })}
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : showGreptileSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="Greptile section">
            {GREPTILE_SIDEBAR_LINKS.map(({ path, icon, label }) => {
              const active = path === '/greptile'
                ? location.pathname === '/greptile'
                : isActive(path, location.pathname);
              return (
                <Link
                  key={path}
                  to={path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : showSentrySidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="Sentry section">
            {SENTRY_SIDEBAR_LINKS.map(({ path, icon, label }) => {
              const active = path === '/sentry' ? location.pathname === '/sentry' : isActive(path, location.pathname);
              return (
                <Link
                  key={path}
                  to={path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="app-shell__sidebar-icon">{icon}</span>
                  <span className="app-shell__sidebar-label">{label}</span>
                </Link>
              );
            })}
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : showTeamSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="Team section">
            <TeamSidebar currentPath={location.pathname} />
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : (
        <main className="app-shell__main">{children}</main>
      )}
    </div>
  );
}

// ─── Dev Team Select (top filter bar) ───────────────────────────────────────

function DevTeamSelect() {
  const { data } = useQuery({ queryKey: DEVELOPER_TEAMS_QUERY_KEY, queryFn: getDeveloperTeams });
  const teams = data?.teams ?? [];
  const activeTeamId = useDeveloperTeamsStore((s) => s.activeTeamId);
  const setActiveTeamId = useDeveloperTeamsStore((s) => s.setActiveTeamId);
  const setDeveloperLogins = useFiltersStore((s) => s.setDeveloperLogins);

  if (teams.length === 0) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setActiveTeamId(null);
      setDeveloperLogins(new Set());
    } else {
      const team = teams.find((t) => t.id === val);
      if (team) {
        setActiveTeamId(team.id);
        setDeveloperLogins(new Set(team.members));
      }
    }
  };

  return (
    <div className="app-shell__filter-row">
      <span className="app-shell__filter-label">Dev team</span>
      <select
        className="dev-team-select"
        value={activeTeamId ?? ''}
        onChange={handleChange}
        aria-label="Filter by developer team"
      >
        <option value="">All devs</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Team Sidebar ────────────────────────────────────────────────────────────

function TeamSidebar({ currentPath }: { currentPath: string }) {
  const queryClient = useQueryClient();
  const { data: teamsData } = useQuery({
    queryKey: DEVELOPER_TEAMS_QUERY_KEY,
    queryFn: getDeveloperTeams,
  });
  const teams = teamsData?.teams ?? [];
  const activeTeamId = useDeveloperTeamsStore((s) => s.activeTeamId);
  const setActiveTeamId = useDeveloperTeamsStore((s) => s.setActiveTeamId);
  const setDeveloperLogins = useFiltersStore((s) => s.setDeveloperLogins);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();

  const createMutation = useMutation({
    mutationFn: ({ name, members }: { name: string; members: string[] }) =>
      createDeveloperTeam(name, members),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVELOPER_TEAMS_QUERY_KEY }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, name, members }: { id: string; name: string; members: string[] }) =>
      updateDeveloperTeam(id, name, members),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVELOPER_TEAMS_QUERY_KEY }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeveloperTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVELOPER_TEAMS_QUERY_KEY }),
  });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMembers, setEditMembers] = useState<Set<string>>(new Set());

  const { data: devsData } = useQuery({
    queryKey: ['developers', startDate, endDate, null],
    queryFn: () => getDevelopers({ start_date: startDate, end_date: endDate }),
  });
  const allDevs = devsData?.developers ?? [];

  const selectTeam = (team: DeveloperTeam) => {
    if (activeTeamId === team.id) {
      setActiveTeamId(null);
      setDeveloperLogins(new Set());
    } else {
      setActiveTeamId(team.id);
      setDeveloperLogins(new Set(team.members));
    }
  };

  const handleCreate = () => {
    if (!newName.trim() || selectedMembers.size === 0) return;
    createMutation.mutate(
      { name: newName.trim(), members: Array.from(selectedMembers) },
      { onSuccess: () => { setNewName(''); setSelectedMembers(new Set()); setCreating(false); } }
    );
  };

  const startEdit = (team: DeveloperTeam) => {
    setEditId(team.id);
    setEditName(team.name);
    setEditMembers(new Set(team.members));
    setCreating(false);
  };

  const handleUpdate = () => {
    if (!editId || !editName.trim() || editMembers.size === 0) return;
    const members = Array.from(editMembers);
    updateMutation.mutate(
      { id: editId, name: editName.trim(), members },
      {
        onSuccess: () => {
          if (activeTeamId === editId) setDeveloperLogins(new Set(editMembers));
          setEditId(null);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    if (activeTeamId === id) {
      setActiveTeamId(null);
      setDeveloperLogins(new Set());
    }
  };

  const toggleMember = (login: string, members: Set<string>, setMembers: (s: Set<string>) => void) => {
    const next = new Set(members);
    if (next.has(login)) next.delete(login);
    else next.add(login);
    setMembers(next);
  };

  const overviewActive = currentPath === '/team';

  return (
    <>
      <Link
        to="/team"
        className={overviewActive ? 'active' : ''}
        aria-current={overviewActive ? 'page' : undefined}
      >
        <span className="app-shell__sidebar-icon">👥</span>
        <span className="app-shell__sidebar-label">Overview</span>
      </Link>

      <span className="app-shell__sidebar-section">Teams</span>

      {teams.map((team) => {
        const isActive = activeTeamId === team.id;
        const isEditing = editId === team.id;

        if (isEditing) {
          return (
            <div key={team.id} className="team-sidebar__form">
              <input
                className="team-sidebar__input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Team name"
                autoFocus
              />
              <div className="team-sidebar__members-list">
                {allDevs.map((d) => (
                  <label key={d.login} className="team-sidebar__member-row">
                    <input
                      type="checkbox"
                      checked={editMembers.has(d.login)}
                      onChange={() => toggleMember(d.login, editMembers, setEditMembers)}
                    />
                    <span>{d.login}</span>
                  </label>
                ))}
              </div>
              <div className="team-sidebar__form-actions">
                <button className="team-sidebar__save-btn" onClick={handleUpdate} disabled={!editName.trim() || editMembers.size === 0}>
                  Save
                </button>
                <button className="team-sidebar__cancel-btn" onClick={() => setEditId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={team.id} className={`team-sidebar__team-item${isActive ? ' team-sidebar__team-item--active' : ''}`}>
            <button
              className="team-sidebar__team-btn"
              onClick={() => selectTeam(team)}
              title={`${team.members.length} member${team.members.length !== 1 ? 's' : ''}`}
            >
              <span className="app-shell__sidebar-icon">🏷</span>
              <span className="app-shell__sidebar-label">{team.name}</span>
              <span className="team-sidebar__member-count">{team.members.length}</span>
            </button>
            <div className="team-sidebar__team-actions">
              <button
                className="team-sidebar__action-btn"
                onClick={() => startEdit(team)}
                aria-label={`Edit ${team.name}`}
                title="Edit"
              >
                ✎
              </button>
              <button
                className="team-sidebar__action-btn team-sidebar__action-btn--delete"
                onClick={() => handleDelete(team.id)}
                aria-label={`Delete ${team.name}`}
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      {!creating && !editId && (
        <button className="team-sidebar__new-btn" onClick={() => setCreating(true)}>
          <span className="app-shell__sidebar-icon">+</span>
          <span className="app-shell__sidebar-label">New team</span>
        </button>
      )}

      {creating && (
        <div className="team-sidebar__form">
          <input
            className="team-sidebar__input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Team name"
            autoFocus
          />
          <div className="team-sidebar__members-list">
            {allDevs.length === 0 && (
              <span className="team-sidebar__empty">No developers found</span>
            )}
            {allDevs.map((d) => (
              <label key={d.login} className="team-sidebar__member-row">
                <input
                  type="checkbox"
                  checked={selectedMembers.has(d.login)}
                  onChange={() => toggleMember(d.login, selectedMembers, setSelectedMembers)}
                />
                <span>{d.login}</span>
              </label>
            ))}
          </div>
          <div className="team-sidebar__form-actions">
            <button
              className="team-sidebar__save-btn"
              onClick={handleCreate}
              disabled={!newName.trim() || selectedMembers.size === 0}
            >
              Save
            </button>
            <button
              className="team-sidebar__cancel-btn"
              onClick={() => { setCreating(false); setNewName(''); setSelectedMembers(new Set()); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface PeriodSelectorProps {
  preset: TimePeriodKey | null;
  onPresetChange: (preset: TimePeriodKey) => void;
}

function PeriodSelector({ preset, onPresetChange }: PeriodSelectorProps) {
  const options: { value: TimePeriodKey; label: string }[] = [
    { value: '1', label: '1 day' },
    { value: '2', label: '2 days' },
    { value: '3', label: '3 days' },
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
  ];
  return (
    <div className="period-selector" role="group" aria-label="Time period">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={preset === value ? 'active' : ''}
          onClick={() => onPresetChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface SprintPickerListProps {
  activeSprint: number | null;
  onSelect: (n: number) => void;
}

function SprintPickerList({ activeSprint, onSelect }: SprintPickerListProps) {
  const currentSprint = getSprintNumber(new Date());
  const sprints: number[] = [];
  for (let n = Math.max(1, currentSprint - 4); n <= currentSprint + 1; n++) {
    sprints.push(n);
  }
  return (
    <div className="sprint-picker-list">
      {sprints.map((n) => {
        const { startDate, endDate } = getSprintDates(n);
        return (
          <button
            key={n}
            type="button"
            className={[
              'sprint-picker-item',
              n === activeSprint ? 'sprint-picker-item--selected' : '',
              n === currentSprint ? 'sprint-picker-item--current' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(n)}
          >
            <span className="sprint-picker-item__name">Sprint {n}</span>
            <span className="sprint-picker-item__dates">{formatDateRangeDisplay(startDate, endDate)}</span>
          </button>
        );
      })}
    </div>
  );
}
