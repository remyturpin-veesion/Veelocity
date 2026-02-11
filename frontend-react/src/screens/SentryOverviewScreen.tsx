import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSentryOverview, getSettings, getRepositories } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import type { SentryOverviewIssue } from '@/types/index.js';

export function SentryOverviewScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();
  useFiltersStore((s) => s.repoIds);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const repoIds = getRepoIdsForApi?.() ?? null;
  const hasRepoFilter = (repoIds?.length ?? 0) > 0;

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sentry', 'overview', repoIds ?? null],
    queryFn: () =>
      getSentryOverview({
        repo_ids: Array.isArray(repoIds) ? repoIds : undefined,
      }),
    enabled: settings?.sentry_configured === true,
  });

  const { data: reposData } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories({ all: true }),
    enabled: hasRepoFilter,
  });

  const projectsFiltered = useMemo(() => {
    const projects = data?.projects ?? [];
    return projects;
  }, [data?.projects]);

  /** Flatten all top issues across projects, with project context; sort by count desc. */
  const topIssuesAcrossProjects = useMemo(() => {
    const out: Array<{ issue: SentryOverviewIssue; projectSlug: string; projectName: string }> = [];
    for (const p of projectsFiltered) {
      for (const iss of p.top_issues ?? []) {
        out.push({
          issue: iss,
          projectSlug: p.slug ?? '',
          projectName: p.name ?? p.slug ?? '',
        });
      }
    }
    out.sort((a, b) => (b.issue.count ?? 0) - (a.issue.count ?? 0));
    return out;
  }, [projectsFiltered]);

  const topIssueEventCount = useMemo(() => {
    let max = 0;
    for (const { issue } of topIssuesAcrossProjects) {
      if ((issue.count ?? 0) > max) max = issue.count ?? 0;
    }
    return max;
  }, [topIssuesAcrossProjects]);

  const totals = data?.org_totals ?? { events_24h: 0, events_7d: 0, open_issues_count: 0 };

  if (settings?.sentry_configured !== true) {
    return (
      <div className="sentry-overview">
        <h1 className="screen-title">Sentry</h1>
        <PageSummary>Errors and issue metrics from your Sentry organization · Production only</PageSummary>
        <EmptyState
          title="Sentry not connected"
          message="Add your Sentry API token and organization in Settings to see errors, open issues, and project metrics here. Create a token in Sentry → Settings → Account → API → Auth Tokens (scopes: project:read, event:read, org:read)."
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
      <div className="sentry-overview">
        <h1 className="screen-title">Sentry</h1>
        <PageSummary>Errors and issue metrics from your Sentry organization · Production only</PageSummary>
        <section className="sentry-overview__section">
          <h2 className="sentry-overview__section-title">Overview</h2>
          <div className="sentry-overview__metrics-grid">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>
        <div className="loading">Loading Sentry overview…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentry-overview">
        <h1 className="screen-title">Sentry</h1>
        <EmptyState
          title="Unable to load Sentry data"
          message={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </div>
    );
  }

  const baseUrl = (data?.sentry_base_url ?? '').replace(/\/$/, '');
  const org = data?.org ?? '';
  const openInSentryUrl = org ? `${baseUrl}/organizations/${org}/issues/` : baseUrl || '#';

  return (
    <div className="sentry-overview">
      <header className="sentry-overview__header">
        <div>
          <h1 className="screen-title">Sentry</h1>
          <PageSummary>
            Errors, open issues, and project metrics · Fixed 24h & 7d periods (not filtered by date) · Production only
          </PageSummary>
        </div>
        {baseUrl && (
          <a
            href={openInSentryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sentry-overview__open-link"
          >
            Open in Sentry →
          </a>
        )}
      </header>

      <section className="sentry-overview__section">
        <h2 className="sentry-overview__section-title">Overview</h2>
        <p className="sentry-overview__section-desc sentry-overview__section-desc--overview">
          Error counts use fixed 24h and 7-day windows (independent of the date filter above).
        </p>
        <div className="sentry-overview__metrics-grid">
          <KpiCard
            title="Total errors (24h)"
            value={formatCompactNumber(totals.events_24h ?? 0)}
            subtitle="fixed period · last 24 hours"
            icon="⚠"
            accent="orange"
          />
          <KpiCard
            title="Total errors (7 days)"
            value={formatCompactNumber(totals.events_7d ?? 0)}
            subtitle="fixed period · last 7 days"
            icon="⚠"
            accent="orange"
          />
          <KpiCard
            title="Open issues"
            value={String(totals.open_issues_count ?? 0)}
            subtitle="unresolved issues (current)"
            icon="📋"
            accent="purple"
          />
          <KpiCard
            title="Projects"
            value={String(projectsFiltered.length)}
            subtitle="tracked projects"
            icon="📦"
            accent="primary"
            to="/sentry/projects"
          />
          <KpiCard
            title="Peak issue events"
            value={formatCompactNumber(topIssueEventCount)}
            subtitle={topIssueEventCount > 0 ? 'most frequent single issue (7d)' : 'no issues'}
            icon="📈"
            accent="orange"
          />
        </div>
      </section>

      {topIssuesAcrossProjects.length > 0 && (
        <section className="sentry-overview__section">
          <h2 className="sentry-overview__section-title">Issues causing problems</h2>
          <p className="sentry-overview__section-desc">Top unresolved issues by event count (Production only)</p>
          <div className="sentry-overview__table-wrap">
            <table className="sentry-overview__table" role="grid">
              <thead>
                <tr>
                  <th>Count</th>
                  <th>Issue</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {topIssuesAcrossProjects.slice(0, 15).map(({ issue, projectSlug, projectName }) => {
                  const issueUrl =
                    org && baseUrl ? `${baseUrl}/organizations/${org}/issues/${issue.id}/` : '#';
                  return (
                    <tr key={`${projectSlug}-${issue.id}`}>
                      <td className="sentry-overview__count">{formatCompactNumber(issue.count ?? 0)}</td>
                      <td>
                        <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="sentry-overview__issue-link">
                          {issue.short_id}: {issue.title || '(no title)'}
                        </a>
                      </td>
                      <td className="sentry-overview__project-cell">{projectName || projectSlug}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="sentry-overview__section">
        <h2 className="sentry-overview__section-title">Projects</h2>
        <p className="sentry-overview__section-desc">
          {projectsFiltered.length === 0
            ? 'No projects'
            : `${projectsFiltered.length} project${projectsFiltered.length === 1 ? '' : 's'}`}
          {' · Production environment only'}
        </p>
        <Link to="/sentry/projects" className="sentry-overview__projects-link">
          View all projects →
        </Link>
      </section>

      <footer className="sentry-overview__filters-footer">
        <span className="sentry-overview__filters-label">Active filters:</span>
        <span className="sentry-overview__filters-value">
          Production only
          {' · '}
          {formatDateRangeDisplay(startDate, endDate)}
          {hasRepoFilter ? (
            reposData?.items?.length ? (
              <>
                {' · '}
                {reposData.items
                  .filter((r) => repoIds?.includes(r.id))
                  .map((r) => r.full_name)
                  .join(', ')}
              </>
            ) : (
              ` · ${repoIds?.length ?? 0} repo(s) selected`
            )
          ) : (
            ' · All repos'
          )}
          {' · '}
          Sentry: fixed 24h & 7d periods
        </span>
      </footer>
    </div>
  );
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default SentryOverviewScreen;
