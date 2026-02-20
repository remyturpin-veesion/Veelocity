import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import {
  getThroughput,
  getPRReviewTime,
  getPRMergeTime,
  getPRHealth,
  getReviewerWorkload,
} from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { KpiCard } from '@/components/KpiCard.js';
import { MetricInfoButton } from '@/components/MetricInfoButton.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';
import { TrendChart } from '@/components/TrendChart.js';

export function PullRequestScreen() {
  useFiltersStore((s) => s.dateRange);
  useFiltersStore((s) => s.repoIds);
  useFiltersStore((s) => s.developerLogins);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const getDeveloperLoginsForApi = useFiltersStore((s) => s.getDeveloperLoginsForApi);
  const developerLoginsParam = getDeveloperLoginsForApi();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();
  const period = useFiltersStore((s) => s.getChartPeriod)();

  const throughput = useQuery({
    queryKey: ['metrics', 'throughput', startDate, endDate, repoIds, developerLoginsParam, period],
    queryFn: () =>
      getThroughput({
        start_date: startDate,
        end_date: endDate,
        period,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        include_trend: true,
        include_benchmark: true,
      }),
    enabled: !noReposSelected,
  });
  const prReviewTime = useQuery({
    queryKey: ['metrics', 'pr-review-time', startDate, endDate, repoIds, developerLoginsParam],
    queryFn: () =>
      getPRReviewTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const prMergeTime = useQuery({
    queryKey: ['metrics', 'pr-merge-time', startDate, endDate, repoIds, developerLoginsParam],
    queryFn: () =>
      getPRMergeTime({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
        include_trend: true,
      }),
    enabled: !noReposSelected,
  });
  const prHealth = useQuery({
    queryKey: ['metrics', 'pr-health', startDate, endDate, repoIds, developerLoginsParam],
    queryFn: () =>
      getPRHealth({
        start_date: startDate,
        end_date: endDate,
        repo_ids: repoIds ?? undefined,
        author_logins: developerLoginsParam,
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

  if (noReposSelected) {
    return (
      <div className="pull-request-screen">
        <div className="screen-title-row pull-request-screen__header">
          <h1 className="screen-title">Pull Request & Code Review</h1>
        </div>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see PR metrics."
        />
      </div>
    );
  }

  const isLoading =
    throughput.isLoading ||
    prReviewTime.isLoading ||
    prMergeTime.isLoading ||
    prHealth.isLoading ||
    reviewerWorkload.isLoading;
  const anyError =
    throughput.error ||
    prReviewTime.error ||
    prMergeTime.error ||
    prHealth.error ||
    reviewerWorkload.error;

  if (isLoading && !throughput.data) {
    return (
      <div className="pull-request-screen">
        <div className="screen-title-row pull-request-screen__header">
          <h1 className="screen-title">Pull Request & Code Review</h1>
        </div>
        <p className="pull-request-screen__date">
          {formatDateRangeDisplay(startDate, endDate)}
        </p>
        <SkeletonCard />
      </div>
    );
  }

  if (anyError) {
    return (
      <div className="pull-request-screen">
        <div className="screen-title-row pull-request-screen__header">
          <h1 className="screen-title">Pull Request & Code Review</h1>
        </div>
        <div className="error">{(anyError as Error).message}</div>
      </div>
    );
  }

  const throughputData = throughput.data as {
    total?: number;
    data?: Array<{ period: string; count: number }>;
  } | undefined;
  const throughputChartData = (throughputData?.data ?? []).map((p) => ({
    label: p.period,
    value: p.count,
  }));
  const reviewData = prReviewTime.data as { count?: number; average_hours?: number } | undefined;
  const mergeData = prMergeTime.data as { count?: number; average_hours?: number } | undefined;
  const healthData = prHealth.data as {
    count?: number;
    summary?: { average_score?: number };
    pr_health_scores?: Array<{
      pr_id: number;
      pr_number?: number;
      title?: string;
      health_score: number;
      health_category?: string;
    }>;
  } | undefined;
  const workloadData = reviewerWorkload.data as {
    workloads?: Array<{
      reviewer_login: string;
      review_count: number;
      percentage_of_total?: number;
      is_bottleneck?: boolean;
      is_under_utilized?: boolean;
    }>;
    summary?: { gini_coefficient?: number };
  } | undefined;

  const workloads = workloadData?.workloads ?? [];

  return (
    <div className="pull-request-screen">
      <header className="pull-request-screen__header">
        <div className="screen-title-row">
          <h1 className="screen-title">Pull Request & Code Review</h1>
        </div>
        <p className="pull-request-screen__intro">
          Track merge throughput, review and merge times, PR health, and reviewer balance for your selected repositories.
        </p>
        <p className="pull-request-screen__date">
          {formatDateRangeDisplay(startDate, endDate)}
        </p>
      </header>

      {/* Core review at a glance */}
      <section aria-labelledby="pr-kpi-title">
        <h2 id="pr-kpi-title" className="pull-request-screen__section-title" style={{ marginBottom: 12 }}>
          Core metrics
        </h2>
        <div className="pull-request-screen__kpi-row">
          <KpiCard
            title="PRs merged"
            value={String(throughputData?.total ?? '—')}
            accent="primary"
          />
          <KpiCard
            title="Avg review time"
            value={reviewData?.average_hours != null ? `${reviewData.average_hours.toFixed(1)} h` : '—'}
            subtitle={reviewData?.count != null ? `${reviewData.count} PRs with reviews` : undefined}
            accent="green"
          />
          <KpiCard
            title="Avg merge time"
            value={mergeData?.average_hours != null ? `${mergeData.average_hours.toFixed(1)} h` : '—'}
            subtitle={mergeData?.count != null ? `${mergeData.count} PRs merged` : undefined}
            accent="purple"
          />
          <KpiCard
            title="PR health score"
            value={
              healthData?.summary?.average_score != null
                ? String(Math.round(healthData.summary.average_score))
                : '—'
            }
            subtitle={healthData?.count != null ? `${healthData.count} PRs scored` : undefined}
            accent="orange"
          />
        </div>
      </section>

      {/* Throughput chart */}
      <section className="pull-request-screen__section" aria-labelledby="pr-throughput-title">
        <div className="pull-request-screen__section-header">
          <div>
            <h2 id="pr-throughput-title" className="pull-request-screen__section-title">
              Throughput
            </h2>
            <p className="pull-request-screen__section-desc">
              Merged PRs over time for the selected period.
            </p>
          </div>
          <MetricInfoButton metricKey="throughput" />
        </div>
        <div className="card pull-request-screen__chart-card">
          {throughputChartData.length > 0 ? (
            <TrendChart data={throughputChartData} title="Merged PRs" height={260} />
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              No merge data in this period.
            </div>
          )}
        </div>
      </section>

      {/* Review time & Merge time */}
      <section aria-labelledby="pr-times-title">
        <h2 id="pr-times-title" className="pull-request-screen__section-title" style={{ marginBottom: 12 }}>
          Review & merge times
        </h2>
        <p className="pull-request-screen__section-desc" style={{ marginBottom: 12 }}>
          Time from PR open to first review, and from open to merge.
        </p>
        <div className="pull-request-screen__review-merge-row">
          <div className="card">
            <div className="pull-request-screen__section-header">
              <span className="card__title">PR review time</span>
              <MetricInfoButton metricKey="pr-review-time" />
            </div>
            <div className="kpi-card__value-row" style={{ marginTop: 8 }}>
              <span className="card__value" style={{ color: 'var(--metric-green)' }}>
                {reviewData?.average_hours != null ? `${reviewData.average_hours.toFixed(1)} h` : '—'}
              </span>
            </div>
            <p className="kpi-card__subtitle">
              {reviewData?.count != null ? `${reviewData.count} PRs with at least one review` : '—'}
            </p>
          </div>
          <div className="card">
            <div className="pull-request-screen__section-header">
              <span className="card__title">PR merge time</span>
              <MetricInfoButton metricKey="pr-merge-time" />
            </div>
            <div className="kpi-card__value-row" style={{ marginTop: 8 }}>
              <span className="card__value" style={{ color: 'var(--metric-purple)' }}>
                {mergeData?.average_hours != null ? `${mergeData.average_hours.toFixed(1)} h` : '—'}
              </span>
            </div>
            <p className="kpi-card__subtitle">
              {mergeData?.count != null ? `${mergeData.count} PRs merged` : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Reviewer workload */}
      <section className="pull-request-screen__section" aria-labelledby="pr-workload-title">
        <div className="pull-request-screen__section-header">
          <div>
            <h2 id="pr-workload-title" className="pull-request-screen__section-title">
              Reviewer workload
            </h2>
            <p className="pull-request-screen__section-desc">
              How review effort is distributed. Balanced workload helps avoid bottlenecks.
            </p>
          </div>
          <MetricInfoButton metricKey="reviewer-workload" />
        </div>
        {workloadData?.summary?.gini_coefficient != null && (
          <p className="pull-request-screen__gini-note">
            <strong>Gini coefficient:</strong> {workloadData.summary.gini_coefficient.toFixed(2)} —{' '}
            higher means workload is more concentrated on few reviewers; lower means more balanced.
          </p>
        )}
        <div className="card">
          {workloads.length === 0 ? (
            <div className="empty-state">No review data in this period.</div>
          ) : (
            <table className="pull-request-screen__reviewer-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Reviews</th>
                  <th>Share</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workloads.map((r) => (
                  <tr key={r.reviewer_login}>
                    <td>
                      <strong>{r.reviewer_login}</strong>
                    </td>
                    <td>{r.review_count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="pull-request-screen__reviewer-bar-wrap">
                          <div
                            className="pull-request-screen__reviewer-bar-fill"
                            style={{ width: `${r.percentage_of_total ?? 0}%` }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {r.percentage_of_total != null ? `${r.percentage_of_total.toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="pull-request-screen__reviewer-badges">
                        {r.is_bottleneck && (
                          <span className="pull-request-screen__badge pull-request-screen__badge--bottleneck">
                            Bottleneck
                          </span>
                        )}
                        {r.is_under_utilized && (
                          <span className="pull-request-screen__badge pull-request-screen__badge--under">
                            Under-utilized
                          </span>
                        )}
                        {!r.is_bottleneck && !r.is_under_utilized && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
