import { useQueries } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getCorrelations } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import type { Correlation } from '@/types/index.js';

const METRIC_LABELS: Record<string, string> = {
  deployment_frequency: 'Deployment frequency',
  throughput: 'Throughput',
  lead_time: 'Lead time',
};

const FIXED_PERIODS = [
  { days: 7, label: 'Last 7 days', period: 'day' as const },
  { days: 30, label: 'Last 30 days', period: 'week' as const },
  { days: 90, label: 'Last 90 days', period: 'week' as const },
];

function getDateRangeForDays(days: number): { start_date: string; end_date: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

function formatMetricName(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_/g, ' ');
}

function correlationStrength(r: number): { label: string; color: string } {
  const abs = Math.abs(r);
  const side = r >= 0 ? 'positive' : 'negative';
  if (abs >= 0.7) return { label: `Strong ${side}`, color: r >= 0 ? 'var(--metric-green)' : 'var(--metric-orange)' };
  if (abs >= 0.4) return { label: `Moderate ${side}`, color: 'var(--primary)' };
  if (abs >= 0.2) return { label: `Weak ${side}`, color: 'var(--metric-purple)' };
  return { label: 'Very weak', color: 'var(--text-muted)' };
}

function CorrCard({ c, period }: { c: Correlation; period?: string }) {
  const r = typeof c.correlation === 'number' ? c.correlation : 0;
  const { label, color } = correlationStrength(r);
  const periodCount = (c as Correlation & { period_count?: number }).period_count;

  return (
    <li
      className="correlations__card"
      style={{
        padding: '8px 10px',
        marginBottom: 6,
        background: 'var(--accent)',
        borderRadius: 6,
        borderLeft: '3px solid ' + color,
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
          {formatMetricName(c.metric_a)}
          <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>↔</span>
          {formatMetricName(c.metric_b)}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color, whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code
          style={{
            fontSize: '0.6875rem',
            padding: '2px 6px',
            background: 'var(--surface)',
            borderRadius: 4,
            color: 'var(--text)',
            border: '1px solid var(--surface-border)',
          }}
        >
          r = {typeof c.correlation === 'number' ? c.correlation.toFixed(3) : String(c.correlation)}
        </code>
        {periodCount != null && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {periodCount} {(period ?? 'week') === 'day' ? 'days' : (period ?? 'week') === 'month' ? 'months' : 'weeks'}
          </span>
        )}
      </div>
    </li>
  );
}

function CorrelationBlock({
  label,
  periodLabel,
  correlations,
  isLoading,
  error,
}: {
  label: string;
  periodLabel: string;
  correlations: Correlation[];
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <div className="card" style={{ marginBottom: 16, padding: 12 }}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>{label}</h2>
      {isLoading && <SkeletonCard />}
      {error && <div className="error" style={{ fontSize: '0.8125rem' }}>{(error as Error).message}</div>}
      {!isLoading && !error && (
        <>
          {correlations.length === 0 ? (
            <div className="empty-state" style={{ padding: 8, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              No correlation data. Need at least 3 periods per pair.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {correlations.map((c, i) => (
                <CorrCard key={i} c={c} period={periodLabel} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function CorrelationsScreen() {
  useFiltersStore((s) => s.repoIds);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();

  const periodQueries = useQueries({
    queries: FIXED_PERIODS.map(({ days, period }) => {
      const { start_date, end_date } = getDateRangeForDays(days);
      return {
        queryKey: ['metrics', 'correlations', days, start_date, end_date, repoIds],
        queryFn: () =>
          getCorrelations({
            start_date,
            end_date,
            period,
            repo_ids: repoIds ?? undefined,
          }),
        enabled: !noReposSelected,
      };
    }),
  });

  if (noReposSelected) {
    return (
      <div className="correlations">
        <h1 className="screen-title">Correlations</h1>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see correlations."
        />
      </div>
    );
  }

  return (
    <div className="correlations">
      <h1 className="screen-title">Correlations</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.8125rem', maxWidth: 560 }}>
        Pearson correlation between metrics (−1 to +1). Repo filter applies to all blocks.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {FIXED_PERIODS.map(({ days, label, period }, i) => {
        const result = periodQueries[i];
        const data = result?.data;
        const correlations = data?.pairs ?? data?.correlations ?? [];
        const periodLabel = period === 'day' ? 'day' : 'week';
        return (
          <CorrelationBlock
            key={days}
            label={label}
            periodLabel={periodLabel}
            correlations={correlations}
            isLoading={result?.isLoading ?? false}
            error={result?.error as Error | null}
          />
        );
      })}
      </div>
    </div>
  );
}
