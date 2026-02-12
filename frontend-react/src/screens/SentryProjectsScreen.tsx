import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSentryOverview, getSettings, getRepositories } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import type { SentryOverviewProject } from '@/types/index.js';

/** Derive Sentry stats period from date range: ≤1 day → 24h, else 7d. */
function statsPeriodFromRange(startDate: string, endDate: string): '24h' | '7d' {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return days <= 1 ? '24h' : '7d';
}

export function SentryProjectsScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const [projectSearch, setProjectSearch] = useState('');
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const repoIds = getRepoIdsForApi?.() ?? null;
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();
  const statsPeriod = statsPeriodFromRange(startDate, endDate);
  const hasRepoFilter = (repoIds?.length ?? 0) > 0;

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sentry', 'overview', startDate, endDate, statsPeriod],
    queryFn: () => getSentryOverview({ stats_period: statsPeriod }),
    enabled: settings?.sentry_configured === true,
  });

  const { data: reposData } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories({ all: true }),
    enabled: hasRepoFilter,
  });

  const projectsFiltered = useMemo(() => {
    const projects = data?.projects ?? [];
    if (!hasRepoFilter || !reposData?.items?.length) return projects;
    const selectedRepos = reposData.items.filter((r) => repoIds!.includes(r.id));
    const selectedFullNames = new Set(selectedRepos.map((r) => r.full_name));
    if (selectedFullNames.size === 0) return projects;
    return projects.filter((p) => {
      const slug = (p.slug || '').toLowerCase();
      return Array.from(selectedFullNames).some((fullName) => {
        const repoPart = fullName.split('/').pop()?.toLowerCase() ?? '';
        return slug === repoPart || fullName.toLowerCase().endsWith('/' + slug);
      });
    });
  }, [data, hasRepoFilter, reposData, repoIds]);

  const matchingRepoBySlug = useMemo(() => {
    const map = new Map<string, string>();
    if (!reposData?.items?.length) return map;
    for (const r of reposData.items) {
      const part = r.full_name.split('/').pop()?.toLowerCase() ?? '';
      if (part && !map.has(part)) map.set(part, r.full_name);
    }
    return map;
  }, [reposData]);

  const projectsToShow = useMemo(() => {
    const list = projectsFiltered;
    const q = projectSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = (p.name ?? '').toLowerCase();
      const slug = (p.slug ?? '').toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [projectsFiltered, projectSearch]);

  if (settings?.sentry_configured !== true) {
    return (
      <div className="sentry-projects">
        <h1 className="screen-title">Sentry Projects</h1>
        <PageSummary>Sentry projects linked to repos · Production only</PageSummary>
        <EmptyState
          title="Sentry not connected"
          message="Add your Sentry API token and organization in Settings."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) return <div className="loading">Loading Sentry projects…</div>;
  if (error) {
    return (
      <EmptyState
        title="Unable to load Sentry data"
        message={(error as Error).message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const baseUrl = (data?.sentry_base_url ?? '').replace(/\/$/, '');
  const org = data?.org ?? '';

  return (
    <div className="sentry-projects">
      <header className="sentry-projects__header">
        <div>
          <h1 className="screen-title">Sentry Projects</h1>
          <PageSummary>
            Sentry projects linked to repos · Fixed 24h & 7d periods · Production only
          </PageSummary>
        </div>
        <Link to="/sentry" className="sentry-projects__back-link">
          ← Overview
        </Link>
      </header>

      <section className="sentry-projects__section" style={{ '--connector-accent': 'var(--metric-purple, #8b5cf6)' } as React.CSSProperties}>
        <h2 className="sentry-projects__section-title">Projects</h2>
        <p className="sentry-projects__section-desc">
          {projectsFiltered.length === 0
            ? 'No projects'
            : `${projectsFiltered.length} project${projectsFiltered.length === 1 ? '' : 's'}`}
        </p>
        {projectsFiltered.length === 0 ? (
          <p className="sentry-projects__empty" style={{ color: 'var(--text-muted)' }}>
            {hasRepoFilter && (repoIds?.length ?? 0) > 0
              ? 'No Sentry projects match the selected repositories.'
              : 'No projects in this organization or no data for the selected period.'}
          </p>
        ) : (
          <>
            <div className="sentry-projects__search-wrap">
              <input
                type="search"
                placeholder="Search projects by name or slug…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                aria-label="Search projects"
                className="sentry-projects__search"
              />
            </div>
            <div className="data-coverage__accordion" style={{ gap: 8 }}>
              {projectsToShow.map((proj: SentryOverviewProject) => (
                <ProjectAccordion
                  key={proj.id}
                  project={proj}
                  baseUrl={baseUrl}
                  org={org}
                  statsPeriod={statsPeriod}
                  matchingRepo={hasRepoFilter ? matchingRepoBySlug.get((proj.slug || '').toLowerCase()) : undefined}
                />
              ))}
            </div>
            {projectsToShow.length === 0 && projectSearch.trim() && (
              <p className="sentry-projects__empty">No projects match &quot;{projectSearch.trim()}&quot;.</p>
            )}
          </>
        )}
      </section>

      <footer className="sentry-overview__filters-footer">
        <span className="sentry-overview__filters-label">Active filters:</span>
        <span className="sentry-overview__filters-value">
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
          {statsPeriod === '24h' ? '24h' : '7d'} stats
        </span>
      </footer>
    </div>
  );
}

function ProjectAccordion({
  project,
  baseUrl,
  org,
  statsPeriod,
  matchingRepo,
}: {
  project: SentryOverviewProject;
  baseUrl: string;
  org: string;
  statsPeriod: '24h' | '7d';
  matchingRepo?: string;
}) {
  const projectUrl = org && project.slug ? `${baseUrl}/organizations/${org}/projects/${project.slug}/` : baseUrl;
  const errorsCount = statsPeriod === '24h' ? (project.events_24h ?? 0) : (project.events_7d ?? 0);
  const hasIssues = project.top_issues && project.top_issues.length > 0;

  return (
    <details className="data-coverage__accordion-item">
      <summary className="data-coverage__accordion-summary">
        <span className="data-coverage__connector-dot" />
        <div className="data-coverage__connector-info" style={{ flex: 1, minWidth: 0 }}>
          <span className="data-coverage__connector-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name || project.slug || project.id}
          </span>
          <span className="data-coverage__connector-sync">
            Errors: <strong>{errorsCount}</strong> · Open issues: <strong>{project.open_issues_count ?? 0}</strong>
            {matchingRepo && ` · Repo: ${matchingRepo}`}
          </span>
        </div>
        <span className="data-coverage__accordion-chevron" aria-hidden />
      </summary>
      <div className="data-coverage__accordion-body">
        <p style={{ margin: '0 0 12px' }}>
          <a href={projectUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', fontWeight: 500 }}>
            Open project in Sentry →
          </a>
        </p>
        {hasIssues ? (
          <>
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 }}>Top unresolved issues</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem' }}>
              {project.top_issues!.slice(0, 5).map((iss) => {
                const issueUrl =
                  org && project.slug
                    ? `${baseUrl}/organizations/${org}/issues/${iss.id}/`
                    : `${baseUrl}/organizations/${org}/issues/`;
                return (
                  <li key={iss.id} style={{ marginBottom: 4 }}>
                    <a href={issueUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>
                      {iss.short_id}: {iss.title || '(no title)'}
                    </a>
                    {iss.count != null && iss.count > 0 && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>({iss.count} events)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>No unresolved issues.</p>
        )}
      </div>
    </details>
  );
}

export default SentryProjectsScreen;
