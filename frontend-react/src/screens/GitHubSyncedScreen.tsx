import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';

export function GitHubSyncedScreen() {
  const repos = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories({ all: true }),
  });

  const reposItems = repos.data?.items ?? [];
  const isLoading = repos.isLoading && !repos.data;
  const hasError = repos.error;

  const repoUrl = (fullName: string) => `https://github.com/${fullName}`;

  if (isLoading) {
    return (
      <div className="github-synced">
        <h1 className="screen-title">Synced repositories</h1>
        <PageSummary>Repositories configured in Settings and synced from GitHub</PageSummary>
        <div className="loading">Loading repositories…</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="github-synced">
        <h1 className="screen-title">Synced repositories</h1>
        <PageSummary>Repositories configured in Settings and synced from GitHub</PageSummary>
        <EmptyState
          title="Unable to load repositories"
          message={(repos.error as Error)?.message ?? 'Check Settings and try again.'}
          actionLabel="Retry"
          onAction={() => repos.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="github-synced">
      <header className="github-synced__header">
        <h1 className="screen-title">Synced repositories</h1>
        <PageSummary>Repositories configured in Settings and synced from GitHub</PageSummary>
      </header>

      <section className="github-synced__section">
        {reposItems.length === 0 ? (
          <p className="github-synced__empty">No repositories. Configure in Settings.</p>
        ) : (
          <div className="github-synced__repos-row" role="list">
            {reposItems.map((r) => (
              <a
                key={r.id}
                href={repoUrl(r.full_name)}
                target="_blank"
                rel="noopener noreferrer"
                className="github-synced__repo-chip"
                role="listitem"
              >
                {r.full_name}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
