import { useQuery } from '@tanstack/react-query';
import { getGreptileMetrics, getSettings } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { useFiltersStore } from '@/stores/filters.js';
import type { GreptileRecommendation } from '@/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  error: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.3)',
    color: 'var(--metric-orange)',
    icon: '\u26A0',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.3)',
    color: 'var(--metric-orange)',
    icon: '\u26A0',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.3)',
    color: 'var(--metric-blue)',
    icon: '\u2139',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.3)',
    color: 'var(--metric-green)',
    icon: '\u2713',
  },
};

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  github: {
    bg: 'rgba(110, 84, 148, 0.15)',
    color: '#8b6db5',
  },
  greptile: {
    bg: 'rgba(59, 130, 246, 0.12)',
    color: 'var(--metric-blue)',
  },
};

const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
  success: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GreptileRecommendationsScreen() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getChartPeriod = useFiltersStore((s) => s.getChartPeriod);
  const getRepoIdsForApi = useFiltersStore((s) => s.getRepoIdsForApi);
  const { startDate, endDate } = getStartEnd();
  const chartPeriod = getChartPeriod();
  const repoIds = getRepoIdsForApi();

  const { data, isLoading, error } = useQuery({
    queryKey: ['greptile', 'metrics', startDate, endDate, repoIds, chartPeriod],
    queryFn: () =>
      getGreptileMetrics({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds,
        granularity: chartPeriod,
      }),
    enabled: settings?.greptile_configured === true || settings?.github_configured === true,
  });

  if (settings?.greptile_configured !== true && settings?.github_configured !== true) {
    return (
      <div>
        <h1 className="screen-title">Recommendations</h1>
        <EmptyState
          title="Greptile not connected"
          message="Add your Greptile API key in Settings to get recommendations."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) return <div className="loading">Loading recommendations\u2026</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  if (!data) return null;

  const recs = [...data.recommendations].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  // Group by severity
  const grouped: Record<string, GreptileRecommendation[]> = {};
  for (const rec of recs) {
    const key = rec.severity;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  }

  const severityLabels: Record<string, string> = {
    error: 'Critical',
    warning: 'Warnings',
    info: 'Suggestions',
    success: 'Positive signals',
  };

  return (
    <div>
      <h1 className="screen-title">Recommendations</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9375rem' }}>
        Actionable recommendations to improve Greptile adoption and code review coverage.
      </p>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['error', 'warning', 'info', 'success'] as const).map((sev) => {
          const count = grouped[sev]?.length ?? 0;
          if (count === 0) return null;
          const s = SEVERITY_STYLE[sev];
          return (
            <div
              key={sev}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: s.color,
                background: s.bg,
                border: `1px solid ${s.border}`,
              }}
            >
              <span>{s.icon}</span>
              <span style={{ fontWeight: 700 }}>{count}</span>
              {severityLabels[sev]}
            </div>
          );
        })}
      </div>

      {recs.length === 0 ? (
        <div className="card" style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No recommendations for the selected period. All looks good!
        </div>
      ) : (
        <>
          {(['error', 'warning', 'info', 'success'] as const).map((sev) => {
            const items = grouped[sev];
            if (!items || items.length === 0) return null;
            return (
              <section key={sev} style={{ marginBottom: 28 }}>
                <h2
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: SEVERITY_STYLE[sev].color,
                    marginBottom: 12,
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{SEVERITY_STYLE[sev].icon}</span>
                  {severityLabels[sev]}
                  <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    ({items.length})
                  </span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map((rec, i) => (
                    <RecommendationCard key={i} rec={rec} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RecommendationCard({ rec }: { rec: GreptileRecommendation }) {
  const style = SEVERITY_STYLE[rec.severity] ?? SEVERITY_STYLE.info;
  return (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: 10,
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{style.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: style.color, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {(rec.tags ?? []).map((tag) => {
              const ts = TAG_STYLE[tag] ?? TAG_STYLE.greptile;
              return (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: ts.bg,
                    color: ts.color,
                  }}
                >
                  {tag}
                </span>
              );
            })}
            {rec.message}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {rec.detail}
          </div>
          {rec.repos.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rec.repos.map((r) => (
                <span
                  key={r}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GreptileRecommendationsScreen;
