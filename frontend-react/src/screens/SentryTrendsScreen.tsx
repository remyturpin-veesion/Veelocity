import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSentryTrends, getSettings } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import type { SentryProjectTrend, SentryWeekSnapshot } from '@/types/index.js';

type SortCol =
  | 'name'
  | 'now_24h'
  | 'now_7d'
  | 'now_issues'
  | 'week1'
  | 'week2'
  | 'week3'
  | 'trend';
type SortDir = 'asc' | 'desc';
type TrendFilter = 'all' | 'improving' | 'stable' | 'degrading' | 'no_data';

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function sortValue(p: SentryProjectTrend, col: SortCol): number | string {
  switch (col) {
    case 'name': return (p.name || p.slug).toLowerCase();
    case 'now_24h': return p.current.events_24h;
    case 'now_7d': return p.current.events_7d;
    case 'now_issues': return p.current.open_issues_count;
    case 'week1': return p.weeks[0]?.events_7d ?? -1;
    case 'week2': return p.weeks[1]?.events_7d ?? -1;
    case 'week3': return p.weeks[2]?.events_7d ?? -1;
    case 'trend': {
      const order = { improving: 0, stable: 1, degrading: 2, insufficient_data: 3 };
      return order[p.trend_direction] ?? 3;
    }
  }
}

function TrendBadge({
  direction,
  pct,
}: {
  direction: SentryProjectTrend['trend_direction'];
  pct: number | null;
}) {
  if (direction === 'insufficient_data') {
    return <span className="sentry-trends__badge sentry-trends__badge--neutral">— no data</span>;
  }
  const arrow = direction === 'improving' ? '↓' : direction === 'degrading' ? '↑' : '→';
  const cls =
    direction === 'improving'
      ? 'sentry-trends__badge--good'
      : direction === 'degrading'
        ? 'sentry-trends__badge--bad'
        : 'sentry-trends__badge--neutral';
  const label =
    direction === 'improving' ? 'Improving' : direction === 'degrading' ? 'Degrading' : 'Stable';
  return (
    <span className={`sentry-trends__badge ${cls}`}>
      {arrow} {label}
      {pct != null && (
        <span className="sentry-trends__badge-pct">
          {' '}({pct > 0 ? '+' : ''}{pct}%)
        </span>
      )}
    </span>
  );
}

function MetricCell({ snap }: { snap: SentryWeekSnapshot | null }) {
  if (!snap) {
    return <td className="sentry-trends__cell sentry-trends__cell--empty">—</td>;
  }
  return (
    <td className="sentry-trends__cell">
      <span className="sentry-trends__errors">{formatNum(snap.events_7d)}</span>
      {snap.open_issues_count > 0 && (
        <span className="sentry-trends__issues">{snap.open_issues_count} issues</span>
      )}
    </td>
  );
}

function CurrentCell({ project }: { project: SentryProjectTrend }) {
  return (
    <td className="sentry-trends__cell sentry-trends__cell--current">
      <span className="sentry-trends__errors sentry-trends__errors--now">
        {formatNum(project.current.events_24h)}
        <span className="sentry-trends__period-label"> /24h</span>
      </span>
      <span className="sentry-trends__errors">
        {formatNum(project.current.events_7d)}
        <span className="sentry-trends__period-label"> /7d</span>
      </span>
      <span className="sentry-trends__issues">{project.current.open_issues_count} issues</span>
    </td>
  );
}

function SortableHeader({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className={`sentry-trends__th sentry-trends__th--sortable${active ? ' sentry-trends__th--active' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => onSort(col)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="sentry-trends__th-inner">
        {label}
        <span className="sentry-trends__sort-icon" aria-hidden>
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </span>
    </th>
  );
}

export function SentryTrendsScreen() {
  const [sortCol, setSortCol] = useState<SortCol>('now_7d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('all');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sentry', 'trends'],
    queryFn: getSentryTrends,
    enabled: settings?.sentry_configured === true,
  });

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const projects = data?.projects ?? [];

  const displayed = useMemo(() => {
    let list = [...projects];

    // Text filter
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.slug || '').toLowerCase().includes(q),
      );
    }

    // Trend filter
    if (trendFilter !== 'all') {
      const map: Record<TrendFilter, SentryProjectTrend['trend_direction']> = {
        all: 'stable',
        improving: 'improving',
        stable: 'stable',
        degrading: 'degrading',
        no_data: 'insufficient_data',
      };
      list = list.filter((p) => p.trend_direction === map[trendFilter]);
    }

    // Sort
    list.sort((a, b) => {
      const va = sortValue(a, sortCol);
      const vb = sortValue(b, sortCol);
      let cmp = 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb);
      } else {
        cmp = (va as number) - (vb as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [projects, search, trendFilter, sortCol, sortDir]);

  if (settings?.sentry_configured !== true) {
    return (
      <div className="sentry-trends">
        <h1 className="screen-title">Sentry Trends</h1>
        <PageSummary>Per-project error and issue trends over time · Production only</PageSummary>
        <EmptyState
          title="Sentry not connected"
          message="Add your Sentry API token and organization in Settings to track error trends here."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="sentry-trends">
        <h1 className="screen-title">Sentry Trends</h1>
        <PageSummary>Per-project error and issue trends over time · Production only</PageSummary>
        <div className="loading">Loading trends…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentry-trends">
        <h1 className="screen-title">Sentry Trends</h1>
        <EmptyState
          title="Unable to load trend data"
          message={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="sentry-trends">
      <header className="sentry-overview__header">
        <div>
          <h1 className="screen-title">Sentry Trends</h1>
          <PageSummary>
            Per-project errors and open issues · Weekly comparison · Production only
          </PageSummary>
        </div>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          message="No Sentry projects have been synced yet. Wait for the next sync or trigger one manually."
        />
      ) : (
        <section className="sentry-overview__section">
          {/* Filter bar */}
          <div className="sentry-trends__filter-bar">
            <input
              type="search"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sentry-trends__search"
              aria-label="Search projects"
            />
            <div className="sentry-trends__trend-filter" role="group" aria-label="Filter by trend">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'improving', label: '↓ Improving' },
                  { value: 'stable', label: '→ Stable' },
                  { value: 'degrading', label: '↑ Degrading' },
                  { value: 'no_data', label: 'No data' },
                ] as { value: TrendFilter; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`sentry-trends__filter-btn${trendFilter === value ? ' sentry-trends__filter-btn--active' : ''}`}
                  onClick={() => setTrendFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="sentry-trends__count">
              {displayed.length} / {projects.length}
            </span>
          </div>

          <div className="sentry-trends__table-wrap">
            <table className="sentry-trends__table">
              <thead>
                <tr>
                  <SortableHeader col="name" label="Project" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="sentry-trends__th--project" />
                  <th className="sentry-trends__th sentry-trends__th--group" colSpan={3}>
                    Now
                  </th>
                  <SortableHeader col="week1" label="-1 week" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="week2" label="-2 weeks" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="week3" label="-3 weeks" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="trend" label="Trend" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                </tr>
                <tr className="sentry-trends__subheader">
                  <th />
                  <SortableHeader col="now_24h" label="24h errors" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="now_7d" label="7d errors" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="now_issues" label="Open issues" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th /><th /><th /><th />
                </tr>
              </thead>
              <tbody>
                {displayed.map((project) => (
                  <tr key={project.id} className="sentry-trends__row">
                    <td className="sentry-trends__project-name">
                      <span className="sentry-trends__name">{project.name || project.slug}</span>
                      <span className="sentry-trends__slug">{project.slug}</span>
                    </td>
                    <td className="sentry-trends__cell sentry-trends__cell--sub">
                      <span className="sentry-trends__errors">{formatNum(project.current.events_24h)}</span>
                    </td>
                    <td className="sentry-trends__cell sentry-trends__cell--sub sentry-trends__cell--current">
                      <span className="sentry-trends__errors">{formatNum(project.current.events_7d)}</span>
                    </td>
                    <td className="sentry-trends__cell sentry-trends__cell--sub">
                      <span className="sentry-trends__issues-inline">{project.current.open_issues_count}</span>
                    </td>
                    <MetricCell snap={project.weeks[0] ?? null} />
                    <MetricCell snap={project.weeks[1] ?? null} />
                    <MetricCell snap={project.weeks[2] ?? null} />
                    <td className="sentry-trends__cell sentry-trends__cell--trend">
                      <TrendBadge direction={project.trend_direction} pct={project.trend_pct} />
                    </td>
                  </tr>
                ))}
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sentry-trends__no-results">
                      No projects match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="sentry-trends__legend">
            Errors shown as 7-day totals per period · Trend compares this week vs last week · Open issues only available for current period
          </p>
        </section>
      )}
    </div>
  );
}

export default SentryTrendsScreen;
