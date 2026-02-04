import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useThemeStore } from '@/stores/theme.js';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { RepoMultiSelector } from '@/components/RepoMultiSelector.js';
import { LinearTeamMultiSelector } from '@/components/LinearTeamMultiSelector.js';
import { SettingsDialog } from '@/components/SettingsDialog.js';
import { ExportButton } from '@/components/ExportButton.js';
import type { TimePeriodKey } from '@/stores/filters.js';

const TABS = [
  { path: '/', label: 'Dashboard' },
  { path: '/team', label: 'Team' },
  { path: '/github', label: 'GitHub' },
  { path: '/linear', label: 'Linear' },
  { path: '/cursor', label: 'Cursor' },
  { path: '/greptile', label: 'Greptile' },
  { path: '/data-coverage', label: 'Data coverage' },
  { path: '/alerts', label: 'Alerts' },
] as const;

/** Sidebar sublinks when on GitHub: Overview + DORA + Dev + Insights, each with icon + label */
const GITHUB_SIDEBAR = {
  overview: { path: '/github', icon: '⊞', label: 'Overview' },
  dora: [
    { path: '/metrics/deployment-frequency', icon: '🚀', label: 'Deployment frequency' },
    { path: '/metrics/lead-time', icon: '⏱', label: 'Lead time' },
  ],
  dev: [
    { path: '/metrics/throughput', icon: '📦', label: 'Throughput' },
    { path: '/metrics/pr-review-time', icon: '👀', label: 'PR review time' },
    { path: '/metrics/pr-merge-time', icon: '🔀', label: 'PR merge time' },
    { path: '/metrics/cycle-time', icon: '🔄', label: 'Cycle time' },
    { path: '/metrics/pr-health', icon: '❤️', label: 'PR health' },
    { path: '/metrics/reviewer-workload', icon: '👥', label: 'Reviewer workload' },
  ],
  insights: [
    { path: '/insights/recommendations', icon: '🛡', label: 'Recommendations' },
    { path: '/insights/correlations', icon: '📈', label: 'Correlations' },
  ],
} as const;

const LINEAR_SIDEBAR_LINKS = [
  { path: '/linear', icon: '⊞', title: 'Overview' },
  { path: '/metrics/linear/issues-completed', icon: '✓', title: 'Issues completed' },
  { path: '/metrics/linear/backlog', icon: '▢', title: 'Backlog' },
  { path: '/metrics/linear/time-in-state', icon: '◷', title: 'Time in state' },
] as const;

function isActive(path: string, current: string): boolean {
  if (path === '/') return current === '/' || current === '/dashboard';
  return current === path || current.startsWith(path + '/');
}

function isLinearRoute(pathname: string): boolean {
  return pathname === '/linear' || pathname.startsWith('/metrics/linear');
}

function isGitHubRoute(pathname: string): boolean {
  return (
    pathname === '/github' ||
    pathname.startsWith('/metrics/') && !pathname.startsWith('/metrics/linear') ||
    pathname.startsWith('/insights/')
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const dateRange = useFiltersStore((s) => s.dateRange);
  const setDateRangePreset = useFiltersStore((s) => s.setDateRangePreset);
  const setDateRangeCustom = useFiltersStore((s) => s.setDateRangeCustom);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const showLinearSidebar = isLinearRoute(location.pathname);
  const showGitHubSidebar = isGitHubRoute(location.pathname);
  const showSidebar = showLinearSidebar || showGitHubSidebar;

  useEffect(() => {
    if (!datePickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [datePickerOpen]);

  return (
    <div className={`app-shell ${showSidebar ? 'app-shell--with-sidebar' : ''}`}>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="app-shell__sticky-header">
      <header className="app-shell__top">
        <Link to="/" className="app-shell__logo" aria-label="Veelocity home">
          <img src="/Veelocity.png" alt="Veelocity" className="app-shell__logo-img" />
        </Link>
        <nav className="app-shell__nav">
          {TABS.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={isActive(path, location.pathname) ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="app-shell__spacer" />
        <ExportButton />
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
        >
          ⚙️
        </button>
      </header>
      {location.pathname !== '/data-coverage' && location.pathname !== '/alerts' && (
        <div className="app-shell__filters">
          <div className="app-shell__filters-inner">
            <div className="app-shell__filter-row">
              <span className="app-shell__filter-label">Repos</span>
              <RepoMultiSelector />
            </div>
            {showLinearSidebar && (
              <div className="app-shell__filter-row">
                <span className="app-shell__filter-label">Teams</span>
                <LinearTeamMultiSelector />
              </div>
            )}
            <div className="app-shell__date-range-wrap app-shell__date-range-wrap--right" ref={datePickerRef}>
              <button
                type="button"
                className="app-shell__date-pill"
                title="Choose date range"
                onClick={() => setDatePickerOpen((o) => !o)}
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
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="app-shell__date-actions">
                    <button
                      type="button"
                      className="app-shell__date-ok"
                      onClick={() => setDatePickerOpen(false)}
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      {showGitHubSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="GitHub section">
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
          </aside>
          <main className="app-shell__main">{children}</main>
        </div>
      ) : showLinearSidebar ? (
        <div className="app-shell__body">
          <aside className="app-shell__sidebar app-shell__sidebar--with-labels" aria-label="Linear section">
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
      ) : (
        <main className="app-shell__main">{children}</main>
      )}
    </div>
  );
}

interface PeriodSelectorProps {
  preset: TimePeriodKey | null;
  onPresetChange: (preset: TimePeriodKey) => void;
}

function PeriodSelector({ preset, onPresetChange }: PeriodSelectorProps) {
  const options: { value: TimePeriodKey; label: string }[] = [
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
