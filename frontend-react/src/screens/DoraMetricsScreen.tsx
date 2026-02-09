import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getExportReport } from '@/api/endpoints.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { EmptyState } from '@/components/EmptyState.js';

function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours >= 24) {
    const days = hours / 24;
    return `${days.toFixed(1)} days`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

interface ReportData {
  period?: {
    start_date?: string;
    end_date?: string;
  };
  dora?: {
    deployment_frequency?: {
      average_per_week?: number;
      total?: number;
    };
    lead_time?: {
      average_hours?: number;
    };
    deployment_reliability?: {
      stability_score?: number;
      failure_rate?: number;
      mttr_hours?: number | null;
    };
  };
  development?: {
    pr_review_time?: {
      average_hours?: number;
      count?: number;
    };
    pr_merge_time?: {
      average_hours?: number;
      count?: number;
    };
    throughput?: {
      total?: number;
      average_per_week?: number;
    };
  };
  alerts?: {
    count?: number;
  };
  recommendations?: {
    count?: number;
    items?: Array<{
      title?: string;
      description?: string;
      priority?: string;
    }>;
  };
}

function MetricRow({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="dashboard-quick-overview__row">
      <span style={{ color: 'var(--text-muted)', minWidth: 200 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{value}</span>
        {subtitle && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{subtitle}</span>
        )}
      </span>
    </div>
  );
}

export function DoraMetricsScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();

  const reportQuery = useQuery({
    queryKey: ['export-report', startDate, endDate],
    queryFn: () =>
      getExportReport({
        start_date: startDate,
        end_date: endDate,
      }),
  });

  const report = reportQuery.data as ReportData | undefined;

  if (reportQuery.isLoading && !report) {
    return (
      <div>
        <h1 className="screen-title">DORA Metrics Report</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {formatDateRangeDisplay(startDate, endDate)}
        </p>
        <div className="dashboard__kpi-row">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (reportQuery.error) {
    return (
      <div>
        <h1 className="screen-title">DORA Metrics Report</h1>
        <EmptyState
          title="Unable to load report"
          message="Make sure the backend is running and try again."
          actionLabel="Retry"
          onAction={() => reportQuery.refetch()}
        />
      </div>
    );
  }

  const dora = report?.dora;
  const dev = report?.development;
  const recs = report?.recommendations;

  return (
    <div>
      <h1 className="screen-title">DORA Metrics Report</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        {formatDateRangeDisplay(startDate, endDate)} &middot; Full report with DORA + development metrics
      </p>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>DORA Metrics</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Core delivery performance</span>
        </div>
        <div className="card">
          <MetricRow
            label="Deployment frequency"
            value={formatNumber(dora?.deployment_frequency?.average_per_week) + ' /week'}
            subtitle={dora?.deployment_frequency?.total != null ? `${dora.deployment_frequency.total} total deployments` : undefined}
          />
          <MetricRow
            label="Lead time for changes"
            value={formatHours(dora?.lead_time?.average_hours)}
            subtitle="average"
          />
          <MetricRow
            label="Change failure rate"
            value={dora?.deployment_reliability?.failure_rate != null ? `${formatNumber(dora.deployment_reliability.failure_rate)}%` : '—'}
          />
          <MetricRow
            label="MTTR"
            value={formatHours(dora?.deployment_reliability?.mttr_hours)}
            subtitle="mean time to recovery"
          />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Development Metrics</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Code review and throughput</span>
        </div>
        <div className="card">
          <MetricRow
            label="PR review time"
            value={formatHours(dev?.pr_review_time?.average_hours)}
            subtitle={dev?.pr_review_time?.count != null ? `${dev.pr_review_time.count} reviews` : undefined}
          />
          <MetricRow
            label="PR merge time"
            value={formatHours(dev?.pr_merge_time?.average_hours)}
            subtitle={dev?.pr_merge_time?.count != null ? `${dev.pr_merge_time.count} PRs` : undefined}
          />
          <MetricRow
            label="Throughput"
            value={formatNumber(dev?.throughput?.average_per_week) + ' /week'}
            subtitle={dev?.throughput?.total != null ? `${dev.throughput.total} total merged PRs` : undefined}
          />
        </div>
      </section>

      {recs && recs.items && recs.items.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <h2 className="dashboard-section-title" style={{ margin: 0 }}>Recommendations</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{recs.count} action items</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recs.items.map((r, i) => (
              <div
                key={i}
                className="card"
                style={{
                  marginBottom: 0,
                  borderLeft: '4px solid var(--primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ fontSize: '0.9375rem' }}>{r.title}</strong>
                  {r.priority && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        textTransform: 'uppercase',
                        flexShrink: 0,
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
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Summary</h2>
        </div>
        <div className="card">
          <MetricRow
            label="Alerts"
            value={report?.alerts?.count != null ? String(report.alerts.count) : '0'}
          />
          <MetricRow
            label="Recommendations"
            value={recs?.count != null ? String(recs.count) : '0'}
          />
          <MetricRow
            label="Period"
            value={`${report?.period?.start_date?.split('T')[0] ?? startDate} to ${report?.period?.end_date?.split('T')[0] ?? endDate}`}
          />
        </div>
      </section>
    </div>
  );
}
