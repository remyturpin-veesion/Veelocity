import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getDevelopers, getDeveloperStats } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import type { Developer } from '@/types/index.js';

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
    <>
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
    </>
  );
}

export function TeamScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['developers', startDate, endDate, repoId],
    queryFn: () => getDevelopers({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (login: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  };

  if (isLoading) return <div className="loading">Loading developers…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const developers: Developer[] = data?.developers ?? [];
  const totalPRs = developers.reduce((s, d) => s + d.prs_merged, 0);
  const totalReviews = developers.reduce((s, d) => s + d.reviews_given, 0);

  return (
    <div className="team-page">
      <h1 className="screen-title">Team</h1>
      <PageSummary>
        Per-developer metrics and activity · {startDate} – {endDate} · Filtered by repos and developers
      </PageSummary>

      {/* KPI row */}
      <div className="dashboard__kpi-row" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KpiCard title="Developers" value={String(developers.length)} icon="👥" />
        <KpiCard title="PRs merged" value={String(totalPRs)} icon="🔀" />
        <KpiCard title="Reviews given" value={String(totalReviews)} icon="👀" />
      </div>

      {developers.length === 0 ? (
        <EmptyState title="No developers" message="No developer activity found in this period. Try expanding the date range or check that GitHub is connected." />
      ) : (
        <div className="team-accordion">
          {developers.map((d) => {
            const isOpen = expandedIds.has(d.login);
            return (
              <div
                key={d.login}
                className={`team-accordion__item${isOpen ? ' team-accordion__item--open' : ''}`}
              >
                <button
                  type="button"
                  className="team-accordion__header"
                  onClick={() => toggle(d.login)}
                  aria-expanded={isOpen}
                >
                  {d.avatar ? (
                    <img
                      src={d.avatar}
                      alt=""
                      className="team-accordion__avatar"
                    />
                  ) : (
                    <span className="team-accordion__avatar-placeholder">
                      {getInitials(d.login)}
                    </span>
                  )}
                  <span className="team-accordion__info">
                    <span className="team-accordion__name">{d.login}</span>
                    <span className="team-accordion__summary">
                      {d.prs_merged} PRs merged · {d.reviews_given} reviews · {d.comments_made} comments
                    </span>
                  </span>
                  <span className="team-accordion__badges">
                    <span className="team-accordion__badge">{d.prs_merged} PRs</span>
                    <span className="team-accordion__badge--green team-accordion__badge">{d.reviews_given} reviews</span>
                  </span>
                  <span className="team-accordion__chevron" />
                </button>
                {isOpen && (
                  <div className="team-accordion__body">
                    <DeveloperDetail
                      login={d.login}
                      startDate={startDate}
                      endDate={endDate}
                      repoId={repoId ?? undefined}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
