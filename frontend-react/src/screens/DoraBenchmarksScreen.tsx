import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import {
  getDeploymentFrequency,
  getLeadTime,
  getDeploymentReliability,
} from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import type { TrendData } from '@/types/index.js';

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

function formatThresholdHours(value: number): string {
  return value >= 24 ? `${(value / 24).toFixed(1)} days` : `${value.toFixed(0)}h`;
}

function BenchmarkTierList({
  title,
  improvementDirection,
  thresholds,
}: {
  title: string;
  improvementDirection: 'higher' | 'lower';
  thresholds: { elite: number; high: number; medium: number };
}) {
  const rows = useMemo(() => {
    if (improvementDirection === 'higher') {
      return [
        { label: 'Elite', value: `>= ${thresholds.elite.toFixed(2)}` },
        { label: 'High', value: `${thresholds.high.toFixed(2)} – ${thresholds.elite.toFixed(2)}` },
        { label: 'Medium', value: `${thresholds.medium.toFixed(2)} – ${thresholds.high.toFixed(2)}` },
        { label: 'Low', value: `< ${thresholds.medium.toFixed(2)}` },
      ];
    }
    return [
      { label: 'Elite', value: `< ${formatThresholdHours(thresholds.elite)}` },
      { label: 'High', value: `${formatThresholdHours(thresholds.elite)} – ${formatThresholdHours(thresholds.high)}` },
      { label: 'Medium', value: `${formatThresholdHours(thresholds.high)} – ${formatThresholdHours(thresholds.medium)}` },
      { label: 'Low', value: `>= ${formatThresholdHours(thresholds.medium)}` },
    ];
  }, [improvementDirection, thresholds]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="dashboard-section-title" style={{ marginBottom: 8 }}>{title}</h3>
      {rows.map((r) => (
        <div key={r.label} className="dashboard-quick-overview__row">
          {renderTierBadge(r.label)}
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderTierBadge(category?: string) {
  if (!category) return null;
  const key = category.toLowerCase();
  const badgeColors: Record<string, { bg: string; fg: string; border: string }> = {
    elite: { bg: 'rgba(34,197,94,0.16)', fg: 'var(--metric-green)', border: 'rgba(34,197,94,0.35)' },
    high: { bg: 'rgba(59,130,246,0.16)', fg: 'var(--primary)', border: 'rgba(59,130,246,0.35)' },
    medium: { bg: 'rgba(249,115,22,0.16)', fg: 'var(--metric-orange)', border: 'rgba(249,115,22,0.35)' },
    low: { bg: 'rgba(244,63,94,0.16)', fg: '#f87171', border: 'rgba(244,63,94,0.35)' },
  };
  const badge = badgeColors[key] ?? badgeColors.medium;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: badge.bg,
        color: badge.fg,
        border: `1px solid ${badge.border}`,
      }}
    >
      {category}
    </span>
  );
}

function stripTierPrefix(description: string | undefined, category: string | undefined): string {
  const raw = description ?? '—';
  if (!category) return raw;
  const prefix = `${category}:`;
  return raw.toLowerCase().startsWith(prefix.toLowerCase()) ? raw.slice(prefix.length).trim() : raw;
}

export function DoraBenchmarksScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  useFiltersStore((s) => s.developerLogins);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const getDeveloperLoginsForApi = useFiltersStore((s) => s.getDeveloperLoginsForApi);
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const repoIds = getRepoIdsForApi();
  const developerLoginsParam = getDeveloperLoginsForApi();
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

  // Use the same query keys as DoraScreen to share cache and ensure identical data
  const deploymentFreq = useQuery({
    queryKey: ['metrics', 'deployment-frequency', startDate, endDate, repoIds, developerLoginsParam, 'week'],
    queryFn: () =>
      getDeploymentFrequency({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        period: 'week',
        include_trend: true,
        include_benchmark: true,
      }),
    enabled: !noReposSelected,
  });

  const leadTime = useQuery({
    queryKey: ['metrics', 'lead-time', startDate, endDate, repoIds, developerLoginsParam],
    queryFn: () =>
      getLeadTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        include_trend: true,
        include_benchmark: true,
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

  const isLoading =
    !noReposSelected &&
    (deploymentFreq.isLoading || leadTime.isLoading || deploymentReliability.isLoading);
  const hasError = deploymentFreq.error || leadTime.error || deploymentReliability.error;

  const depFreqData = deploymentFreq.data as {
    average?: number;
    total?: number;
    trend?: TrendData;
    benchmark?: {
      category?: string;
      description?: string;
      gap_to_elite?: string;
      thresholds?: { elite: number; high: number; medium: number };
      improvement_direction?: 'higher' | 'lower';
    };
  } | undefined;
  const leadTimeData = leadTime.data as {
    average_hours?: number;
    median_hours?: number;
    count?: number;
    trend?: TrendData;
    benchmark?: {
      category?: string;
      description?: string;
      gap_to_elite?: string;
      thresholds?: { elite: number; high: number; medium: number };
      improvement_direction?: 'higher' | 'lower';
    };
  } | undefined;
  const relData = deploymentReliability.data as {
    failure_rate?: number;
    mttr_hours?: number | null;
    trend?: TrendData;
  } | undefined;

  if (noReposSelected) {
    return (
      <div>
        <h1 className="screen-title">DORA Benchmarks</h1>
        <PageSummary>Industry benchmarks vs your metrics · {formatDateRangeDisplay(startDate, endDate)} · Filtered by repos</PageSummary>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see benchmark positioning."
        />
      </div>
    );
  }

  if (isLoading && !depFreqData) {
    return (
      <div>
        <h1 className="screen-title">DORA Benchmarks</h1>
        <PageSummary>Industry benchmarks vs your metrics · {formatDateRangeDisplay(startDate, endDate)} · Filtered by repos</PageSummary>
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
        <h1 className="screen-title">DORA Benchmarks</h1>
        <PageSummary>Industry benchmarks vs your metrics · Filtered by date range and repos</PageSummary>
        <EmptyState
          title="Unable to load benchmark data"
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 className="screen-title">DORA Benchmarks</h1>
      </div>
      <PageSummary>Industry benchmarks vs your metrics · {formatDateRangeDisplay(startDate, endDate)} · Filtered by repos</PageSummary>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Your latest stats</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Compared with benchmark tiers</span>
        </div>
        <div className="dashboard__kpi-row">
          <KpiCard
            title="Deployment frequency"
            value={depFreqData?.average != null ? `${depFreqData.average.toFixed(1)} /week` : '—'}
            subtitle={depFreqData?.total != null ? `${depFreqData.total} deployments` : undefined}
            icon="🚀"
            info={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderTierBadge(depFreqData?.benchmark?.category)}
                <MetricInfoButton metricKey="deployment-frequency" />
              </span>
            )}
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
            icon="⏱"
            info={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderTierBadge(leadTimeData?.benchmark?.category)}
                <MetricInfoButton metricKey="lead-time" />
              </span>
            )}
            trend={
              leadTimeData?.trend
                ? { change_percent: leadTimeData.trend.change_percent, is_improving: leadTimeData.trend.is_improving }
                : undefined
            }
          />
          <KpiCard
            title="Change failure rate (proxy)"
            value={relData?.failure_rate != null ? `${relData.failure_rate.toFixed(1)}%` : '—'}
            subtitle={relData?.mttr_hours != null ? `MTTR ${relData.mttr_hours}h` : 'No benchmark data'}
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
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Placement summary</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Where you stand among industry tiers</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 className="dashboard-section-title">Deployment frequency</h3>
            {depFreqData?.benchmark?.category && (
              <div className="dashboard-quick-overview__row">
                <span style={{ color: 'var(--text-muted)' }}>Tier</span>
                {renderTierBadge(depFreqData.benchmark.category)}
              </div>
            )}
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Description</span>
              <span>{stripTierPrefix(depFreqData?.benchmark?.description, depFreqData?.benchmark?.category)}</span>
            </div>
            {depFreqData?.benchmark?.gap_to_elite && (
              <div className="dashboard-quick-overview__row">
                <span style={{ color: 'var(--text-muted)' }}>Gap to Elite</span>
                <span>{depFreqData.benchmark.gap_to_elite}</span>
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="dashboard-section-title">Lead time for changes</h3>
            {leadTimeData?.benchmark?.category && (
              <div className="dashboard-quick-overview__row">
                <span style={{ color: 'var(--text-muted)' }}>Tier</span>
                {renderTierBadge(leadTimeData.benchmark.category)}
              </div>
            )}
            <div className="dashboard-quick-overview__row">
              <span style={{ color: 'var(--text-muted)' }}>Description</span>
              <span>{stripTierPrefix(leadTimeData?.benchmark?.description, leadTimeData?.benchmark?.category)}</span>
            </div>
            {leadTimeData?.benchmark?.gap_to_elite && (
              <div className="dashboard-quick-overview__row">
                <span style={{ color: 'var(--text-muted)' }}>Gap to Elite</span>
                <span>{leadTimeData.benchmark.gap_to_elite}</span>
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="dashboard-section-title">Notes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Change failure rate</div>
                <div>Proxy based on failed deployment workflow runs</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>MTTR</div>
                <div>Proxy based on time to next successful run</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Comparison table</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>You vs Industry Avg vs Top Quartile</span>
        </div>
        <div className="card">
          <div className="empty-state">
            Comparison data is not yet available. Add industry averages and top quartile values on the backend to populate this table.
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Industry tier breakdown</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Thresholds used for classification</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {depFreqData?.benchmark?.thresholds && depFreqData.benchmark.improvement_direction ? (
            <BenchmarkTierList
              title="Deployment frequency (per week)"
              improvementDirection={depFreqData.benchmark.improvement_direction}
              thresholds={depFreqData.benchmark.thresholds}
            />
          ) : (
            <div className="card">
              <h3 className="dashboard-section-title">Deployment frequency</h3>
              <div className="empty-state">No benchmark thresholds available.</div>
            </div>
          )}
          {leadTimeData?.benchmark?.thresholds && leadTimeData.benchmark.improvement_direction ? (
            <BenchmarkTierList
              title="Lead time for changes"
              improvementDirection={leadTimeData.benchmark.improvement_direction}
              thresholds={leadTimeData.benchmark.thresholds}
            />
          ) : (
            <div className="card">
              <h3 className="dashboard-section-title">Lead time for changes</h3>
              <div className="empty-state">No benchmark thresholds available.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
