import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
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
import { PageSummary } from '@/components/PageSummary.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { EmptyState } from '@/components/EmptyState.js';

export function GitHubOverviewScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const repoIds = getRepoIdsForApi();
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  const repos = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getRepositories({ all: true }),
  });
  const deploymentFreq = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoIds],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const leadTime = useQuery({
    queryKey: ['metrics', 'lead-time', startDate, endDate, repoIds],
    queryFn: () =>
      getLeadTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const throughput = useQuery({
    queryKey: ['metrics', 'throughput', startDate, endDate, repoIds],
    queryFn: () =>
      getThroughput({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const prReviewTime = useQuery({
    queryKey: ['metrics', 'pr-review-time', startDate, endDate, repoIds],
    queryFn: () =>
      getPRReviewTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const prMergeTime = useQuery({
    queryKey: ['metrics', 'pr-merge-time', startDate, endDate, repoIds],
    queryFn: () =>
      getPRMergeTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const prHealth = useQuery({
    queryKey: ['metrics', 'pr-health', startDate, endDate, repoIds],
    queryFn: () =>
      getPRHealth({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_summary: true,
      }),
    enabled: !noReposSelected,
  });
  const reviewerWorkload = useQuery({
    queryKey: ['metrics', 'reviewer-workload', startDate, endDate, repoIds],
    queryFn: () =>
      getReviewerWorkload({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
      }),
    enabled: !noReposSelected,
  });

  const reposItems = repos.data?.items ?? [];
  const isLoadingRepos = repos.isLoading && !repos.data;
  const hasReposError = repos.error;
  const isLoadingMetrics =
    !noReposSelected &&
    (deploymentFreq.isLoading || leadTime.isLoading || throughput.isLoading) &&
    !deploymentFreq.data;
  const hasMetricsError = deploymentFreq.error || leadTime.error;

  if (noReposSelected) {
    return (
      <div className="github-overview">
        <h1 className="screen-title">GitHub</h1>
        <PageSummary>Repositories, PRs, and deployment metrics · Filtered by date range and repos</PageSummary>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see GitHub metrics."
        />
      </div>
    );
  }

  if (isLoadingRepos && reposItems.length === 0) {
    return (
      <div className="github-overview">
        <h1 className="screen-title">GitHub</h1>
        <PageSummary>Repositories, PRs, and deployment metrics · Filtered by date range and repos</PageSummary>
        <div className="loading">Loading repositories…</div>
      </div>
    );
  }

  if (hasReposError) {
    return (
      <div className="github-overview">
        <h1 className="screen-title">GitHub</h1>
        <PageSummary>Repositories, PRs, and deployment metrics · Filtered by date range and repos</PageSummary>
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
    <div className="github-overview">
      <header className="github-overview__header">
        <div>
          <h1 className="screen-title">GitHub</h1>
          <PageSummary>
            Repositories, PRs, and deployment metrics · {formatDateRangeDisplay(startDate, endDate)} · Filtered by repos
          </PageSummary>
        </div>
      </header>

      <section className="github-overview__section">
        <h2 className="github-overview__section-title">Metrics</h2>
      {isLoadingMetrics && !deploymentFreq.data ? (
        <div className="github-overview__metrics-grid">
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
        <div className="github-overview__metrics-grid" data-tour="github-kpis">
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
            to="/github/pull-request"
            icon="📦"
          />
        </div>
      )}
      </section>

      <section className="github-overview__section">
        <h2 className="github-overview__section-title">Code Review</h2>
        {isLoadingMetrics && !prReviewTime.data ? (
          <div className="github-overview__metrics-grid">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="github-overview__metrics-grid">
            <KpiCard
              title="PR review time"
              value={
                prReviewTimeData?.average_hours != null
                  ? `${prReviewTimeData.average_hours.toFixed(1)} h`
                  : '—'
              }
              subtitle={prReviewTimeData?.count != null ? `${prReviewTimeData.count} PRs` : undefined}
              to="/github/pull-request"
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
              to="/github/pull-request"
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
              to="/github/pull-request"
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
              to="/github/pull-request"
              icon="👥"
            />
          </div>
        )}
      </section>
    </div>
  );
}
