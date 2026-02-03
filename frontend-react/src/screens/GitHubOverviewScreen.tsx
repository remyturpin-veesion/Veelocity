import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import {
  getRepositories,
  getDeploymentFrequency,
  getLeadTime,
  getThroughput,
  getPRReviewTime,
  getPRMergeTime,
  getPRHealth,
  getReviewerWorkload,
} from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { EmptyState } from '@/components/EmptyState.js';

export function GitHubOverviewScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const repos = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories(),
  });
  const deploymentFreq = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoId],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });
  const leadTime = useQuery({
    queryKey: ['metrics', 'lead-time', startDate, endDate, repoId],
    queryFn: () =>
      getLeadTime({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });
  const throughput = useQuery({
    queryKey: ['metrics', 'throughput', startDate, endDate, repoId],
    queryFn: () =>
      getThroughput({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });
  const prReviewTime = useQuery({
    queryKey: ['metrics', 'pr-review-time', startDate, endDate, repoId],
    queryFn: () =>
      getPRReviewTime({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });
  const prMergeTime = useQuery({
    queryKey: ['metrics', 'pr-merge-time', startDate, endDate, repoId],
    queryFn: () =>
      getPRMergeTime({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
      }),
  });
  const prHealth = useQuery({
    queryKey: ['metrics', 'pr-health', startDate, endDate, repoId],
    queryFn: () =>
      getPRHealth({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_summary: true,
      }),
  });
  const reviewerWorkload = useQuery({
    queryKey: ['metrics', 'reviewer-workload', startDate, endDate, repoId],
    queryFn: () =>
      getReviewerWorkload({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
      }),
  });

  const reposItems = repos.data?.items ?? [];
  const isLoadingRepos = repos.isLoading && !repos.data;
  const hasReposError = repos.error;
  const isLoadingMetrics =
    (deploymentFreq.isLoading || leadTime.isLoading || throughput.isLoading) && !deploymentFreq.data;
  const hasMetricsError = deploymentFreq.error || leadTime.error;

  if (isLoadingRepos && reposItems.length === 0) {
    return (
      <div>
        <h1 className="screen-title">GitHub</h1>
        <div className="loading">Loading repositories…</div>
      </div>
    );
  }

  if (hasReposError) {
    return (
      <div>
        <h1 className="screen-title">GitHub</h1>
        <EmptyState
          title="Unable to load repositories"
          message={(repos.error as Error)?.message ?? 'Check Settings and try again.'}
          actionLabel="Retry"
          onAction={() => repos.refetch()}
        />
      </div>
    );
  }

  const deploymentFreqData = deploymentFreq.data as { total?: number; average?: number } | undefined;
  const leadTimeData = leadTime.data as { average_hours?: number; count?: number } | undefined;
  const throughputData = throughput.data as { total?: number } | undefined;
  const prReviewTimeData = prReviewTime.data as { average_hours?: number; count?: number } | undefined;
  const prMergeTimeData = prMergeTime.data as { average_hours?: number; count?: number } | undefined;
  const prHealthData = prHealth.data as { summary?: { total_prs?: number; average_score?: number } } | undefined;
  const reviewerWorkloadData = reviewerWorkload.data as {
    summary?: { total_reviews?: number; unique_reviewers?: number };
  } | undefined;

  return (
    <div>
      <h1 className="screen-title">GitHub</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate}
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__title">Synced repositories</div>
        {reposItems.length === 0 ? (
          <div className="empty-state">No repositories. Configure in Settings.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {reposItems.map((r) => (
              <li key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <strong>{r.full_name}</strong> (id: {r.id})
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>
        Metrics
      </h2>
      {isLoadingMetrics && !deploymentFreq.data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : hasMetricsError ? (
        <EmptyState
          title="Unable to load metrics"
          message="Make sure the backend is running and try again."
          actionLabel="Retry"
          onAction={() => {
            deploymentFreq.refetch();
            leadTime.refetch();
            throughput.refetch();
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <KpiCard
            title="Deployment frequency"
            value={String(deploymentFreqData?.total ?? '—')}
            subtitle="deployments in period"
            to="/metrics/deployment-frequency"
            icon="🚀"
          />
          <KpiCard
            title="Lead time"
            value={
              leadTimeData?.average_hours != null
                ? `${leadTimeData.average_hours.toFixed(1)} h`
                : '—'
            }
            subtitle={leadTimeData?.count != null ? `${leadTimeData.count} changes` : undefined}
            to="/metrics/lead-time"
            icon="⏱"
          />
          <KpiCard
            title="Throughput"
            value={String(throughputData?.total ?? '—')}
            subtitle="PRs merged"
            to="/metrics/throughput"
            icon="📦"
          />
          <KpiCard
            title="PR review time"
            value={
              prReviewTimeData?.average_hours != null
                ? `${prReviewTimeData.average_hours.toFixed(1)} h`
                : '—'
            }
            subtitle={prReviewTimeData?.count != null ? `${prReviewTimeData.count} PRs` : undefined}
            to="/metrics/pr-review-time"
            icon="👀"
          />
          <KpiCard
            title="PR merge time"
            value={
              prMergeTimeData?.average_hours != null
                ? `${prMergeTimeData.average_hours.toFixed(1)} h`
                : '—'
            }
            subtitle={prMergeTimeData?.count != null ? `${prMergeTimeData.count} PRs` : undefined}
            to="/metrics/pr-merge-time"
            icon="🔀"
          />
          <KpiCard
            title="PR health"
            value={
              prHealthData?.summary?.average_score != null
                ? prHealthData.summary.average_score.toFixed(1)
                : '—'
            }
            subtitle={prHealthData?.summary?.total_prs != null ? `${prHealthData.summary.total_prs} PRs` : undefined}
            to="/metrics/pr-health"
            icon="❤️"
          />
          <KpiCard
            title="Reviewer workload"
            value={String(reviewerWorkloadData?.summary?.total_reviews ?? '—')}
            subtitle={
              reviewerWorkloadData?.summary?.unique_reviewers != null
                ? `${reviewerWorkloadData.summary.unique_reviewers} reviewers`
                : undefined
            }
            to="/metrics/reviewer-workload"
            icon="👥"
          />
        </div>
      )}
    </div>
  );
}
