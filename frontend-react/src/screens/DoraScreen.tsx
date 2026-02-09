import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import {
  getDeploymentFrequency,
  getLeadTime,
  getDeploymentReliability,
  getLeadTimeByPeriod,
  getRecommendations,
} from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import type { TrendData, Recommendation } from '@/types/index.js';

function formatHours(hours: number): string {
  if (hours >= 24) {
    const days = hours / 24;
    return `${days.toFixed(1)} days`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

function BenchmarkRow({
  title,
  benchmark,
}: {
  title: string;
  benchmark?: {
    category?: string;
    description?: string;
    gap_to_elite?: string;
  } | null;
}) {
  if (!benchmark) {
    return (
      <div className="dashboard-quick-overview__row">
        <span style={{ color: 'var(--text-muted)' }}>{title}</span>
        <span>Benchmark not available</span>
      </div>
    );
  }
  return (
    <div className="dashboard-quick-overview__row">
      <span style={{ color: 'var(--text-muted)' }}>{title}</span>
      <span>
        {benchmark.category ? benchmark.category.toUpperCase() + ' · ' : ''}
        {benchmark.description ?? '—'}
      </span>
      {benchmark.gap_to_elite && (
        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{benchmark.gap_to_elite}</span>
      )}
    </div>
  );
}

function RecommendationRow({ r }: { r: Recommendation }) {
  return (
    <li
      style={{
        padding: 16,
        marginBottom: 12,
        background: 'var(--accent)',
        borderRadius: 8,
        borderLeft: '4px solid var(--primary)',
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1rem' }}>{r.title}</strong>
        {r.priority && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--primary)',
              textTransform: 'uppercase',
            }}
          >
            {r.priority}
          </span>
        )}
      </div>
      {r.description && (
        <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.5 }}>
          {r.description}
        </p>
      )}
      {r.metric_context && (
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {r.metric_context}
        </p>
      )}
    </li>
  );
}

export function DoraScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getChartPeriod = useFiltersStore((s) => s.getChartPeriod);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const repoIds = getRepoIdsForApi();
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();
  const chartPeriod = getChartPeriod();

  const deploymentFreq = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoIds, chartPeriod],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        period: chartPeriod,
        include_trend: true,
        include_benchmark: true,
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
        include_benchmark: true,
      }),
    enabled: !noReposSelected,
  });

  const leadTimeByPeriod = useQuery({
    queryKey: ['metrics', 'lead-time-by-period', startDate, endDate, repoIds, chartPeriod],
    queryFn: () =>
      getLeadTimeByPeriod({
        start_date: startDate,
        end_date: endDate,
        period: chartPeriod,
        repo_ids: repoIds ?? undefined,
      }),
    enabled: !noReposSelected,
  });

  const deploymentReliability = useQuery({
    queryKey: ['metrics', 'deployment-reliability', startDate, endDate, repoIds],
    queryFn: () =>
      getDeploymentReliability({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });

  const recommendations = useQuery({
    queryKey: ['recommendations', startDate, endDate, repoIds],
    queryFn: () => getRecommendations({ start_date: startDate, end_date: endDate, repo_ids: repoIds ?? undefined }),
    enabled: !noReposSelected,
  });

  const isLoading =
    !noReposSelected &&
    (deploymentFreq.isLoading || leadTime.isLoading || deploymentReliability.isLoading);
  const hasError = deploymentFreq.error || leadTime.error || deploymentReliability.error;

  const depFreqData = deploymentFreq.data as {
    data?: { period: string; count: number }[];
    average?: number;
    total?: number;
    trend?: TrendData;
    benchmark?: { category?: string; description?: string; gap_to_elite?: string };
  } | undefined;
  const leadTimeData = leadTime.data as {
    average_hours?: number;
    median_hours?: number;
    count?: number;
    trend?: TrendData;
    benchmark?: { category?: string; description?: string; gap_to_elite?: string };
  } | undefined;
  const relData = deploymentReliability.data as {
    failure_rate?: number;
    mttr_hours?: number | null;
    trend?: TrendData;
  } | undefined;

  const deploymentChartData = useMemo(() => {
    const data = depFreqData?.data ?? [];
    return data.map((d) => ({ label: d.period, value: d.count }));
  }, [depFreqData?.data]);

  const leadTimeChartData = useMemo(() => {
    const rows = leadTimeByPeriod.data ?? [];
    return rows.map((r) => ({ label: r.period, value: r.median_hours }));
  }, [leadTimeByPeriod.data]);

  if (noReposSelected) {
    return (
      <div>
        <h1 className="screen-title">DORA</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {formatDateRangeDisplay(startDate, endDate)}
        </p>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see DORA metrics."
        />
      </div>
    );
  }

  if (isLoading && !depFreqData) {
    return (
      <div>
        <h1 className="screen-title">DORA</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {formatDateRangeDisplay(startDate, endDate)}
        </p>
        <div className="dashboard__kpi-row">
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
        <h1 className="screen-title">DORA</h1>
        <EmptyState
          title="Unable to load DORA metrics"
          message="Make sure the backend is running and try again."
          actionLabel="Retry"
          onAction={() => {
            deploymentFreq.refetch();
            leadTime.refetch();
            deploymentReliability.refetch();
          }}
        />
      </div>
    );
  }

  const recs = recommendations.data?.recommendations ?? [];

  return (
    <div>
      <h1 className="screen-title">DORA</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Overview</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Core DORA signals</span>
        </div>
        <div className="dashboard__kpi-row">
        <KpiCard
          title="Deployment frequency"
          value={depFreqData?.average != null ? `${depFreqData.average.toFixed(1)} /day` : '—'}
          subtitle={depFreqData?.total != null ? `${depFreqData.total} deployments` : undefined}
          to="/metrics/deployment-frequency"
          icon="🚀"
          info={<MetricInfoButton metricKey="deployment-frequency" />}
          trend={
            depFreqData?.trend
              ? { change_percent: depFreqData.trend.change_percent, is_improving: depFreqData.trend.is_improving }
              : undefined
          }
        />
        <KpiCard
          title="Lead time for changes"
          value={leadTimeData?.average_hours != null ? formatHours(leadTimeData.average_hours) : '—'}
          subtitle={leadTimeData?.count != null ? `${leadTimeData.count} changes` : undefined}
          to="/metrics/lead-time"
          icon="⏱"
          info={<MetricInfoButton metricKey="lead-time" />}
          trend={
            leadTimeData?.trend
              ? { change_percent: leadTimeData.trend.change_percent, is_improving: leadTimeData.trend.is_improving }
              : undefined
          }
        />
        <KpiCard
          title="Change failure rate (proxy)"
          value={relData?.failure_rate != null ? `${relData.failure_rate.toFixed(1)}%` : '—'}
          subtitle={relData?.mttr_hours != null ? `MTTR ${relData.mttr_hours}h` : undefined}
          to="/metrics/deployment-frequency"
          icon="📉"
          accent="orange"
          info={<MetricInfoButton metricKey="change-failure-rate" />}
          trend={
            relData?.trend
              ? { change_percent: relData.trend.change_percent, is_improving: relData.trend.is_improving }
              : undefined
          }
        />
        <KpiCard
          title="MTTR (proxy)"
          value={relData?.mttr_hours != null ? formatHours(relData.mttr_hours) : '—'}
          subtitle="Mean time to recovery"
          icon="🧯"
          accent="orange"
          info={<MetricInfoButton metricKey="mttr" />}
        />
      </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Benchmarks</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Industry comparisons (where available)</span>
        </div>
        <div className="dashboard__middle" style={{ marginTop: 0 }}>
          <div className="card">
            <BenchmarkRow title="Deployment frequency" benchmark={depFreqData?.benchmark} />
            <BenchmarkRow title="Lead time for changes" benchmark={leadTimeData?.benchmark} />
            <BenchmarkRow title="Change failure rate" benchmark={null} />
            <BenchmarkRow title="MTTR" benchmark={null} />
          </div>
          <div className="card">
            <h3 className="dashboard-section-title">Notes</h3>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Change failure rate</span>
              <span>Proxy based on failed deployment workflow runs</span>
            </div>
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>MTTR</span>
              <span>Proxy based on time to next successful run</span>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Trends</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Time series for core metrics</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className="card">
            <TrendChart data={deploymentChartData} title="Deployment frequency trend" height={240} />
          </div>
          <div className="card">
            <TrendChart data={leadTimeChartData} title="Lead time trend (median)" height={240} />
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Recommendations</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Prioritized actions from existing rules</span>
        </div>
        <div className="card">
          {recs.length === 0 ? (
            <div className="empty-state">No recommendations for this period.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recs.slice(0, 3).map((r) => (
                <RecommendationRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
