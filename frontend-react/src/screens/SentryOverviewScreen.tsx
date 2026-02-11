import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSentryOverview, getSettings, getRepositories } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { useFiltersStore } from '@/stores/filters.js';
import type { SentryOverviewProject } from '@/types/index.js';

/** Derive Sentry stats period from date range: ≤1 day → 24h, else 7d. */
function statsPeriodFromRange(startDate: string, endDate: string): '24h' | '7d' {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return days <= 1 ? '24h' : '7d';
}

export function SentryOverviewScreen() {
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

  const { data, isLoading, error } = useQuery({
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
  }, [data?.projects, hasRepoFilter, reposData?.items, repoIds]);

  const matchingRepoBySlug = useMemo(() => {
    const map = new Map<string, string>();
    if (!reposData?.items?.length) return map;
    for (const r of reposData.items) {
      const part = r.full_name.split('/').pop()?.toLowerCase() ?? '';
      if (part && !map.has(part)) map.set(part, r.full_name);
    }
    return map;
  }, [reposData?.items]);

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
      <div>
        <h1 className="screen-title">Sentry</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Error and issue metrics from your Sentry organization
        </p>
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

  if (isLoading) return <div className="loading">Loading Sentry overview…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const baseUrl = (data?.sentry_base_url ?? '').replace(/\/$/, '');
  const org = data?.org ?? '';
  const orgTotals = data?.org_totals ?? { events_24h: 0, events_7d: 0, open_issues_count: 0 };
  const openInSentryUrl = org ? `${baseUrl}/organizations/${org}/issues/` : baseUrl || '#';

  return (
    <div>
      <h1 className="screen-title">Sentry</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Errors and open issues from your Sentry organization. Data is synced periodically and shown from the Veelocity database.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {baseUrl && (
          <a
            href={openInSentryUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--link)' }}
          >
            Open in Sentry
          </a>
        )}
      </div>

      <section style={{ marginBottom: 32, '--connector-accent': 'var(--metric-purple, #8b5cf6)' } as React.CSSProperties}>
        <h2 className="data-coverage__connector-name" style={{ marginBottom: 8, fontSize: '1rem' }}>
          Summary
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>
          Errors and open issues for the selected date range
        </p>
        <div
          className="dashboard__kpi-row"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', maxWidth: 900 }}
        >
          <KpiCard
            title="Errors"
            value={String(statsPeriod === '24h' ? (orgTotals.events_24h ?? 0) : (orgTotals.events_7d ?? 0))}
            icon="⚠"
          />
          <KpiCard title="Open issues" value={String(orgTotals.open_issues_count ?? 0)} icon="📋" />
        </div>
      </section>

      <section style={{ '--connector-accent': 'var(--metric-purple, #8b5cf6)' } as React.CSSProperties}>
        <h2 className="data-coverage__connector-name" style={{ marginBottom: 8, fontSize: '1rem' }}>
          Projects
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>
          {projectsFiltered.length === 0
            ? 'No projects'
            : `${projectsFiltered.length} project${projectsFiltered.length === 1 ? '' : 's'}`}
        </p>
        {projectsFiltered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {hasRepoFilter && (repoIds?.length ?? 0) > 0
              ? 'No Sentry projects match the selected repositories.'
              : 'No projects in this organization or no data for the selected period.'}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 12, maxWidth: 320 }}>
              <input
                type="search"
                placeholder="Search projects by name or slug…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                aria-label="Search projects"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: 6,
                  background: 'var(--bg, #fff)',
                  color: 'var(--text)',
                }}
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
              <p style={{ color: 'var(--text-muted)', margin: '12px 0 0' }}>
                No projects match &quot;{projectSearch.trim()}&quot;.
              </p>
            )}
          </>
        )}
      </section>
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

export default SentryOverviewScreen;
