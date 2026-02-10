import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSentryOverview, getSettings, getRepositories } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { useFiltersStore } from '@/stores/filters.js';
import type { SentryOverviewProject } from '@/types/index.js';

export function SentryOverviewScreen() {
  const [statsPeriod, setStatsPeriod] = useState<'24h' | '7d'>('24h');
  const [onlyMatchingRepos, setOnlyMatchingRepos] = useState(false);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi?.() ?? null);
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected?.() ?? true);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['sentry', 'overview', statsPeriod],
    queryFn: () => getSentryOverview({ stats_period: statsPeriod }),
    enabled: settings?.sentry_configured === true,
  });

  const { data: reposData } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories(),
    enabled: onlyMatchingRepos && (repoIds?.length ?? 0) > 0,
  });

  const projectsFiltered = useMemo(() => {
    const projects = data?.projects ?? [];
    if (!onlyMatchingRepos || !reposData?.items?.length) return projects;
    const selectedRepos =
      (repoIds?.length ?? 0) > 0 ? reposData.items.filter((r) => repoIds!.includes(r.id)) : [];
    const selectedFullNames = new Set(selectedRepos.map((r) => r.full_name));
    if (selectedFullNames.size === 0) return projects;
    return projects.filter((p) => {
      const slug = (p.slug || '').toLowerCase();
      return Array.from(selectedFullNames).some((fullName) => {
        const repoPart = fullName.split('/').pop()?.toLowerCase() ?? '';
        return slug === repoPart || fullName.toLowerCase().endsWith('/' + slug);
      });
    });
  }, [data?.projects, onlyMatchingRepos, reposData?.items, repoIds]);

  const matchingRepoBySlug = useMemo(() => {
    const map = new Map<string, string>();
    if (!reposData?.items?.length) return map;
    for (const r of reposData.items) {
      const part = r.full_name.split('/').pop()?.toLowerCase() ?? '';
      if (part && !map.has(part)) map.set(part, r.full_name);
    }
    return map;
  }, [reposData?.items]);

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
        Errors and open issues from your Sentry organization. Data is fetched on demand; no import into Veelocity.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['24h', '7d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setStatsPeriod(p)}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid var(--surface-border)',
                background: statsPeriod === p ? 'var(--color-primary, #3b82f6)' : 'transparent',
                color: statsPeriod === p ? 'white' : 'var(--text)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Last {p}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={onlyMatchingRepos}
            onChange={(e) => setOnlyMatchingRepos(e.target.checked)}
          />
          Only projects matching selected repos
        </label>
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

      <div className="dashboard__kpi-row" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', maxWidth: 900 }}>
        <KpiCard title="Errors (24h)" value={String(orgTotals.events_24h ?? 0)} icon="⚠" />
        <KpiCard title="Errors (7d)" value={String(orgTotals.events_7d ?? 0)} icon="⚠" />
        <KpiCard title="Open issues" value={String(orgTotals.open_issues_count ?? 0)} icon="📋" />
      </div>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Projects</h2>
      {projectsFiltered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          {onlyMatchingRepos && (repoIds?.length ?? 0) > 0
            ? 'No Sentry projects match the selected repositories.'
            : 'No projects in this organization or no data for the selected period.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {projectsFiltered.map((proj: SentryOverviewProject) => (
            <ProjectCard
              key={proj.id}
              project={proj}
              baseUrl={baseUrl}
              org={org}
              matchingRepo={onlyMatchingRepos ? matchingRepoBySlug.get((proj.slug || '').toLowerCase()) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  baseUrl,
  org,
  matchingRepo,
}: {
  project: SentryOverviewProject;
  baseUrl: string;
  org: string;
  matchingRepo?: string;
}) {
  const projectUrl = org && project.slug ? `${baseUrl}/organizations/${org}/projects/${project.slug}/` : baseUrl;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <a
          href={projectUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--link)' }}
        >
          {project.name || project.slug || project.id}
        </a>
        {matchingRepo && (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-muted)',
            }}
          >
            Repo: {matchingRepo}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Errors 24h: <strong>{project.events_24h ?? 0}</strong>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Errors 7d: <strong>{project.events_7d ?? 0}</strong>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Open issues: <strong>{project.open_issues_count ?? 0}</strong>
        </span>
      </div>
      {project.top_issues && project.top_issues.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 }}>Top unresolved issues</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem' }}>
            {project.top_issues.slice(0, 5).map((iss) => {
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
        </div>
      )}
    </div>
  );
}

export default SentryOverviewScreen;
