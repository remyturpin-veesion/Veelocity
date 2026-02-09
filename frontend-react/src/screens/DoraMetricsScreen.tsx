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

const INDUSTRY_SUMMARY_2025 = [
  {
    label: 'AI adoption',
    value: '90%',
    detail: 'of respondents use AI as part of their work',
  },
  {
    label: 'Productivity lift',
    value: '>80%',
    detail: 'report increased productivity from AI',
  },
  {
    label: 'Trust gap',
    value: '30%',
    detail: 'report little to no trust in AI-generated code',
  },
  {
    label: 'Platform engineering',
    value: '90%',
    detail: 'of organizations have adopted platform engineering',
  },
];

const INDUSTRY_DEPLOYMENT_FREQUENCY_2025 = [
  { label: 'Fewer than once per six months', share: 3.6, maxPerWeek: 1 / 26 },
  { label: 'Between once per month and once every six months', share: 20.3, maxPerWeek: 1 / 4 },
  { label: 'Between once per week and once per month', share: 31.5, maxPerWeek: 1 },
  { label: 'Between once per day and once per week', share: 21.9, maxPerWeek: 7 },
  { label: 'Between once per hour and once per day', share: 6.5, maxPerWeek: 168 },
  { label: 'On demand (multiple deploys per day)', share: 16.2, maxPerWeek: Number.POSITIVE_INFINITY },
];

const INDUSTRY_LEAD_TIME_2025 = [
  { label: 'More than six months', share: 2.0, maxHours: Number.POSITIVE_INFINITY, minHours: 6 * 30 * 24 },
  { label: 'Between one month and six months', share: 13.2, maxHours: 6 * 30 * 24, minHours: 30 * 24 },
  { label: 'Between one week and one month', share: 28.3, maxHours: 30 * 24, minHours: 7 * 24 },
  { label: 'Between one day and one week', share: 31.9, maxHours: 7 * 24, minHours: 24 },
  { label: 'Less than one day', share: 15.0, maxHours: 24, minHours: 1 },
  { label: 'Less than one hour', share: 9.4, maxHours: 1, minHours: 0 },
];

const INDUSTRY_RECOVERY_TIME_2025 = [
  { label: 'More than six months', share: 1.0, maxHours: Number.POSITIVE_INFINITY, minHours: 6 * 30 * 24 },
  { label: 'Between one month and six months', share: 4.9, maxHours: 6 * 30 * 24, minHours: 30 * 24 },
  { label: 'Between one week and one month', share: 9.4, maxHours: 30 * 24, minHours: 7 * 24 },
  { label: 'Between one day and one week', share: 28.0, maxHours: 7 * 24, minHours: 24 },
  { label: 'Less than one day', share: 35.3, maxHours: 24, minHours: 1 },
  { label: 'Less than one hour', share: 21.3, maxHours: 1, minHours: 0 },
];

function classifyDeploymentFrequency(valuePerWeek: number | null | undefined) {
  if (valuePerWeek == null) return null;
  return (
    INDUSTRY_DEPLOYMENT_FREQUENCY_2025.find((bucket) => valuePerWeek < bucket.maxPerWeek) ??
    INDUSTRY_DEPLOYMENT_FREQUENCY_2025[INDUSTRY_DEPLOYMENT_FREQUENCY_2025.length - 1]
  );
}

function classifyHours(valueHours: number | null | undefined, buckets: typeof INDUSTRY_LEAD_TIME_2025) {
  if (valueHours == null) return null;
  return (
    buckets.find((bucket) => valueHours >= bucket.minHours && valueHours < bucket.maxHours) ??
    buckets[0]
  );
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

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '6px 0 4px' }}>{value}</div>
      <div style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.4 }}>{detail}</div>
    </div>
  );
}

function TierTable({
  title,
  valueLabel,
  value,
  buckets,
  tierLabels,
  formatBucket,
  highlight,
}: {
  title: string;
  valueLabel: string;
  value: string;
  buckets: Array<{ label: string; share: number }>;
  tierLabels: string[];
  formatBucket: (b: { label: string; share: number }) => string;
  highlight?: { label: string; share: number } | null;
}) {
  const palette = [
    { bg: 'rgba(244,63,94,0.16)', fg: '#f87171', border: 'rgba(244,63,94,0.35)' },
    { bg: 'rgba(249,115,22,0.16)', fg: 'var(--metric-orange)', border: 'rgba(249,115,22,0.35)' },
    { bg: 'rgba(234,179,8,0.16)', fg: '#facc15', border: 'rgba(234,179,8,0.35)' },
    { bg: 'rgba(59,130,246,0.16)', fg: 'var(--primary)', border: 'rgba(59,130,246,0.35)' },
    { bg: 'rgba(14,165,233,0.16)', fg: '#38bdf8', border: 'rgba(14,165,233,0.35)' },
    { bg: 'rgba(34,197,94,0.16)', fg: 'var(--metric-green)', border: 'rgba(34,197,94,0.35)' },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <h3 className="dashboard-section-title" style={{ margin: 0 }}>{title}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{valueLabel}: {value}</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `220px repeat(${buckets.length}, minmax(140px, 1fr))`,
          gap: 8,
        }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Tier</div>
        {buckets.map((bucket) => {
          const isActive = highlight?.label === bucket.label;
          return (
            <div
              key={bucket.label}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${isActive ? 'rgba(59,130,246,0.45)' : 'rgba(148,163,184,0.18)'}`,
                background: isActive ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.08)',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {isActive ? 'Veesion' : 'Industry'}
            </div>
          );
        })}

        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Range</div>
        {buckets.map((bucket) => {
          const isActive = highlight?.label === bucket.label;
          const tierLabel = tierLabels[Math.min(tierLabels.length - 1, buckets.indexOf(bucket))] ?? 'Tier';
          const tierStyle = palette[Math.min(palette.length - 1, buckets.indexOf(bucket))];
          return (
            <div
              key={`${bucket.label}-range`}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${isActive ? 'rgba(59,130,246,0.45)' : 'rgba(148,163,184,0.18)'}`,
                background: isActive ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.04)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: tierStyle.bg,
                  color: tierStyle.fg,
                  border: `1px solid ${tierStyle.border}`,
                  marginBottom: 8,
                }}
              >
                {tierLabel}
              </span>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bucket.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                {formatBucket(bucket)}
              </div>
            </div>
          );
        })}
      </div>
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
  const depFreqBucket = classifyDeploymentFrequency(dora?.deployment_frequency?.average_per_week ?? null);
  const leadTimeBucket = classifyHours(dora?.lead_time?.average_hours ?? null, INDUSTRY_LEAD_TIME_2025);
  const mttrBucket = classifyHours(dora?.deployment_reliability?.mttr_hours ?? null, INDUSTRY_RECOVERY_TIME_2025);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="screen-title">DORA Metrics Report 2025</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            {formatDateRangeDisplay(startDate, endDate)} &middot; 2025 industry report summary with DORA comparisons
          </p>
        </div>
        <div
          className="card"
          style={{
            padding: '12px 14px',
            minWidth: 220,
            marginBottom: 24,
            alignSelf: 'flex-start',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Source report
          </div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>DORA 2025 PDF</div>
          <a
            href="/dora/DORA_2025_state_of_ai_assisted_software_development.pdf"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              marginTop: 8,
              color: 'var(--primary)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Open report
          </a>
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>2025 Industry Summary</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            DORA State of AI-assisted Software Development (2025)
          </span>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
            Based on a global survey of nearly 5,000 technology professionals (June 13 – July 21, 2025) plus
            100+ hours of qualitative research, the 2025 report finds AI is now nearly universal and acts as an
            amplifier of existing organizational strengths and weaknesses.
          </p>
        </div>
        <div className="dashboard__kpi-row">
          {INDUSTRY_SUMMARY_2025.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} detail={item.detail} />
          ))}
        </div>
      </section>

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
          <h2 className="dashboard-section-title" style={{ margin: 0 }}>Industry Benchmarks (2025)</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Where you sit vs industry distribution</span>
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <TierTable
            title="Deployment frequency"
            valueLabel="Veesion"
            value={dora?.deployment_frequency?.average_per_week != null
              ? `${formatNumber(dora.deployment_frequency.average_per_week)} /week`
              : '—'}
            buckets={INDUSTRY_DEPLOYMENT_FREQUENCY_2025}
            tierLabels={['Low', 'Below avg', 'Mid', 'Above avg', 'High', 'Elite']}
            highlight={depFreqBucket}
            formatBucket={(bucket) => `${bucket.share}% of industry`}
          />
          <TierTable
            title="Lead time for changes"
            valueLabel="Veesion"
            value={formatHours(dora?.lead_time?.average_hours)}
            buckets={INDUSTRY_LEAD_TIME_2025}
            tierLabels={['Low', 'Below avg', 'Mid', 'Above avg', 'High', 'Elite']}
            highlight={leadTimeBucket}
            formatBucket={(bucket) => `${bucket.share}% of industry`}
          />
          <TierTable
            title="MTTR"
            valueLabel="Veesion"
            value={formatHours(dora?.deployment_reliability?.mttr_hours)}
            buckets={INDUSTRY_RECOVERY_TIME_2025}
            tierLabels={['Low', 'Below avg', 'Mid', 'Above avg', 'High', 'Elite']}
            highlight={mttrBucket}
            formatBucket={(bucket) => `${bucket.share}% of industry`}
          />
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Change failure rate: the 2025 report provides a rework-rate distribution rather than direct change-failure benchmarks.
          </div>
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
