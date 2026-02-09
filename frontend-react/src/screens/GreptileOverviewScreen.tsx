import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getGreptileMetrics, getSettings } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { useFiltersStore } from '@/stores/filters.js';
import type {
  GreptileRepoMetric,
  GreptileRecommendation,
  GreptileTrendPoint,
} from '@/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INDEX_STATUS_LABEL: Record<string, string> = {
  indexed: 'Indexed',
  active: 'Active',
  not_indexed: 'Not indexed',
  stale: 'Stale',
  error: 'Error',
};

const INDEX_STATUS_COLOR: Record<string, string> = {
  indexed: 'var(--metric-green)',
  active: 'var(--metric-blue)',
  not_indexed: 'var(--text-muted)',
  stale: 'var(--metric-orange)',
  error: 'var(--metric-orange)',
};

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

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  return `${v}%`;
}

function fmtMinutes(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  if (v < 60) return `${v}m`;
  const h = Math.floor(v / 60);
  const m = Math.round(v % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  return v.toLocaleString();
}

function fmtWeekLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

type SortKey = 'repo_name' | 'index_status' | 'review_coverage_pct' | 'avg_response_time_minutes' | 'avg_comments_per_pr' | 'total_prs';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GreptileOverviewScreen() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Subscribe to raw state so component re-renders on filter changes
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

  // Table sorting
  const [sortKey, setSortKey] = useState<SortKey>('index_status');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedRepos = useMemo(() => {
    if (!data?.per_repo) return [];
    const rows = [...data.per_repo];
    const statusPriority: Record<string, number> = { error: 0, not_indexed: 1, active: 2, stale: 3, indexed: 4 };
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'repo_name') {
        cmp = a.repo_name.localeCompare(b.repo_name);
      } else if (sortKey === 'index_status') {
        cmp = (statusPriority[a.index_status] ?? 9) - (statusPriority[b.index_status] ?? 9);
      } else {
        const va = a[sortKey] ?? -Infinity;
        const vb = b[sortKey] ?? -Infinity;
        cmp = (va as number) - (vb as number);
      }
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [data?.per_repo, sortKey, sortAsc]);

  const trendData = useMemo(
    () =>
      (data?.trend ?? []).map((w: GreptileTrendPoint) => ({
        ...w,
        label: fmtWeekLabel(w.week),
      })),
    [data?.trend]
  );

  // ---- Empty / not-configured states ----

  if (settings?.greptile_configured !== true && settings?.github_configured !== true) {
    return (
      <div>
        <h1 className="screen-title">Greptile</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          AI code review coverage and Greptile adoption metrics
        </p>
        <EmptyState
          title="Greptile not connected"
          message="Add your Greptile API key in Settings to track AI code review coverage. Connect GitHub first to enable cross-referencing."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) return <div className="loading">Loading Greptile metrics\u2026</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  if (!data) return null;

  const ih = data.index_health;

  // ---- Main render ----

  return (
    <div>
      <h1 className="screen-title">Greptile</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.9375rem' }}>
        AI code review coverage and adoption metrics.{' '}
        <a
          href="https://app.greptile.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--link)' }}
        >
          Open Greptile app
        </a>
      </p>

      {/* ====== SECTION 1: Index Health ====== */}
      <SectionHeading title="Index Health" />
      <div className="dashboard__kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard
          title="Indexed repos"
          value={`${ih.indexed_repos} / ${ih.total_github_repos}`}
          subtitle={ih.total_github_repos === 0 ? 'no GitHub repos' : ih.indexed_repos === ih.total_github_repos ? 'all repos indexed' : `${ih.total_github_repos - ih.indexed_repos} not indexed`}
          accent={ih.indexed_repos === ih.total_github_repos ? 'green' : 'orange'}
        />
        <KpiCard
          title="File coverage"
          value={fmtPct(ih.file_coverage_pct)}
          subtitle={ih.total_files > 0 ? `${fmtNum(ih.total_files_processed)} of ${fmtNum(ih.total_files)} files` : undefined}
          accent={ih.file_coverage_pct != null && ih.file_coverage_pct >= 90 ? 'green' : 'orange'}
        />
        <KpiCard
          title="Stale indexes"
          value={String(ih.stale_repos)}
          subtitle={ih.stale_repos === 0 ? 'all up to date' : 'repos need re-index'}
          accent={ih.stale_repos === 0 ? 'green' : 'orange'}
        />
        <KpiCard
          title="Index errors"
          value={String(ih.error_repos)}
          subtitle={ih.error_repos === 0 ? 'no errors' : 'repos have errors'}
          accent={ih.error_repos === 0 ? 'green' : 'orange'}
        />
      </div>

      {/* ====== SECTION 2: Code Review Coverage ====== */}
      <SectionHeading title="Code Review Coverage" />
      <div className="dashboard__kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard
          title="Review coverage"
          value={`${data.review_coverage_pct}%`}
          subtitle={`${data.prs_reviewed_by_greptile} of ${data.total_prs} PRs reviewed`}
          accent={data.review_coverage_pct >= 80 ? 'green' : data.review_coverage_pct >= 50 ? 'orange' : 'orange'}
        />
        <KpiCard
          title="Avg response time"
          value={fmtMinutes(data.avg_response_time_minutes)}
          subtitle="from PR creation to Greptile review"
          accent={data.avg_response_time_minutes != null && data.avg_response_time_minutes <= 10 ? 'green' : 'primary'}
        />
        <KpiCard
          title="Avg comments / PR"
          value={data.avg_comments_per_pr != null ? String(data.avg_comments_per_pr) : '\u2014'}
          subtitle="Greptile review comments"
          accent="primary"
        />
        <KpiCard
          title="PRs without review"
          value={String(data.prs_without_review)}
          subtitle={data.total_prs > 0 ? `${Math.round(100 * data.prs_without_review / data.total_prs)}% of PRs` : 'no PRs in range'}
          accent={data.prs_without_review === 0 ? 'green' : 'orange'}
        />
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: 0, marginBottom: 16, color: 'var(--text)' }}>
            {chartPeriod === 'day' ? 'Daily' : 'Weekly'} review coverage trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="coverageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="var(--text-muted)"
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: '0.8125rem' }}
                labelStyle={{ color: 'var(--text)' }}
                formatter={((value: number, name: string) => {
                  if (name === 'coverage_pct') return [`${value}%`, 'Coverage'];
                  return [value, name];
                }) as never}
              />
              <Area
                type="monotone"
                dataKey="coverage_pct"
                stroke="var(--primary)"
                fillOpacity={1}
                fill="url(#coverageGrad)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--primary)' }}
                name="coverage_pct"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ====== SECTION 3: Per-Repo Breakdown ====== */}
      {sortedRepos.length > 0 && (
        <>
          <SectionHeading title="Per-Repository Breakdown" />
          <div className="card" style={{ marginBottom: 28 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)', textAlign: 'left' }}>
                    <SortableTh label="Repository" sortKey="repo_name" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortableTh label="Index Status" sortKey="index_status" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortableTh label="Review Coverage" sortKey="review_coverage_pct" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortableTh label="Avg Response" sortKey="avg_response_time_minutes" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortableTh label="Avg Comments" sortKey="avg_comments_per_pr" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortableTh label="PRs" sortKey="total_prs" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedRepos.map((r: GreptileRepoMetric) => (
                    <tr key={r.repo_name} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.repo_name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge status={r.index_status} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.review_coverage_pct != null ? (
                          <CoverageBar pct={r.review_coverage_pct} label={`${r.reviewed_prs}/${r.total_prs}`} />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {fmtMinutes(r.avg_response_time_minutes)}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {r.avg_comments_per_pr != null ? r.avg_comments_per_pr : '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {r.total_prs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ====== SECTION 4: Recommendations ====== */}
      {data.recommendations.length > 0 && (
        <>
          <SectionHeading title="Recommendations" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {data.recommendations.map((rec: GreptileRecommendation, i: number) => (
              <RecommendationCard key={i} rec={rec} />
            ))}
          </div>
        </>
      )}

      {data.total_prs === 0 && (
        <div className="card" style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No pull requests found in the selected date range. Adjust the date filter to see Greptile review metrics.
        </div>
      )}
    </div>
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ title }: { title: string }) {
  return (
    <h2
      style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: 12,
        marginTop: 8,
      }}
    >
      {title}
    </h2>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = INDEX_STATUS_LABEL[status] ?? status;
  const color = INDEX_STATUS_COLOR[status] ?? 'var(--text-muted)';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 500,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

function CoverageBar({ pct, label }: { pct: number; label: string }) {
  const barColor =
    pct >= 80
      ? 'var(--metric-green)'
      : pct >= 50
        ? 'var(--metric-orange)'
        : 'var(--metric-orange)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: 'var(--surface-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: '100%',
            borderRadius: 3,
            background: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {fmtPct(pct)} ({label})
      </span>
    </div>
  );
}

function SortableTh({
  label,
  sortKey: key,
  currentSort,
  asc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = currentSort === key;
  return (
    <th
      onClick={() => onSort(key)}
      style={{
        padding: '10px 12px',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {active && (
        <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>{asc ? '\u25B2' : '\u25BC'}</span>
      )}
    </th>
  );
}

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
        <div>
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
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
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
