import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import {
  getDeploymentFrequency,
  getLeadTime,
  getThroughput,
  getLinearOverview,
  getRecommendations,
} from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import type { LinearOverview } from '@/types/index.js';

export function DashboardScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

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
  const linearOverview = useQuery({
    queryKey: ['linear', 'overview', startDate, endDate],
    queryFn: () => getLinearOverview({ start_date: startDate, end_date: endDate }),
  });
  const recommendations = useQuery({
    queryKey: ['metrics', 'recommendations', startDate, endDate, repoId],
    queryFn: () => getRecommendations({ start_date: startDate, end_date: endDate, repo_id: repoId ?? undefined }),
  });

  const isLoading =
    deploymentFreq.isLoading ||
    leadTime.isLoading ||
    (throughput.isLoading && !deploymentFreq.data);
  const hasError = deploymentFreq.error || leadTime.error;

  if (isLoading && !deploymentFreq.data) {
    return (
      <div>
        <h1 className="screen-title">Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {startDate} – {endDate}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div>
        <h1 className="screen-title">Dashboard</h1>
        <EmptyState
          title="Unable to load metrics"
          message="Make sure the backend is running and try again."
          actionLabel="Retry"
          onAction={() => {
            deploymentFreq.refetch();
            leadTime.refetch();
          }}
        />
      </div>
    );
  }

  const deploymentFreqData = deploymentFreq.data as { total?: number; average?: number } | undefined;
  const leadTimeData = leadTime.data as { average_hours?: number; count?: number } | undefined;
  const throughputData = throughput.data as { total?: number } | undefined;
  const linearData = linearOverview.data as LinearOverview | undefined;
  const recs = recommendations.data?.recommendations?.length ?? 0;

  return (
    <div>
      <h1 className="screen-title">Dashboard</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {startDate} – {endDate}
      </p>
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
          value="—"
          subtitle="See detail"
          to="/metrics/pr-review-time"
          icon="👀"
        />
        <KpiCard
          title="PR merge time"
          value="—"
          subtitle="See detail"
          to="/metrics/pr-merge-time"
          icon="🔀"
        />
        <KpiCard
          title="Cycle time"
          value="—"
          subtitle="See detail"
          to="/metrics/cycle-time"
          icon="🔄"
        />
        <KpiCard
          title="Linear issues completed"
          value={String(linearData?.issues_completed ?? '—')}
          subtitle="in period"
          to="/metrics/linear/issues-completed"
          icon="✅"
        />
        <KpiCard
          title="Linear backlog"
          value={String(linearData?.backlog_count ?? '—')}
          subtitle="open issues"
          to="/metrics/linear/backlog"
          icon="📋"
        />
        <KpiCard
          title="Recommendations"
          value={String(recs)}
          subtitle="insights"
          to="/insights/recommendations"
          icon="💡"
        />
      </div>
    </div>
  );
}
