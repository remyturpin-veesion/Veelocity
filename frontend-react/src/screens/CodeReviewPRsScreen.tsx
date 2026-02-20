import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';
import { getPRHealth, getPRDetail } from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

type PRScore = {
  pr_id: number;
  pr_number?: number;
  title?: string;
  health_score: number;
  health_category?: string;
};

function PRRowAccordion({ pr }: { pr: PRScore }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="code-review-prs__pr-row"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="code-review-prs__pr-summary">
        #{pr.pr_number ?? pr.pr_id}
        {pr.title ? ` — ${pr.title}` : ''} (score {pr.health_score})
      </summary>
      {open && <PRRowContent prId={pr.pr_id} />}
    </details>
  );
}

function PRRowContent({ prId }: { prId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pr', prId],
    queryFn: () => getPRDetail(prId, true),
  });

  if (isLoading) return <div className="code-review-prs__pr-body">Loading…</div>;
  if (error) return <div className="code-review-prs__pr-body error">{(error as Error).message}</div>;
  if (!data) return null;

  const repo = data.repository;
  const githubUrl = repo ? `https://github.com/${repo.full_name}/pull/${data.number}` : null;

  return (
    <div className="code-review-prs__pr-body">
      <p style={{ margin: '0 0 8px' }}>
        by {data.author_login} · {data.state}
        {data.draft && ' (draft)'}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        +{data.additions} / −{data.deletions}
        {data.merged_at && ` · merged ${data.merged_at}`}
      </p>
      {githubUrl && (
        <a href={githubUrl} target="_blank" rel="noreferrer" className="code-review-prs__pr-link">
          Open on GitHub →
        </a>
      )}
      {data.health && (
        <div style={{ marginTop: 12 }}>
          <strong>Health:</strong> {data.health.health_score} — {data.health.health_category}
          {data.health.issues?.length ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {data.health.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {data.reviews?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Reviews:</strong>{' '}
          {data.reviews.map((r) => r.reviewer_login + ': ' + r.state).join(', ')}
        </div>
      )}
      {data.comments?.length > 0 && (
        <div style={{ marginTop: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {data.comments.length} comment{data.comments.length === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

export function CodeReviewPRsScreen() {
  useFiltersStore((s) => s.developerLogins);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoIds = useFiltersStore((s) => s.getRepoIdsForApi)();
  const getDeveloperLoginsForApi = useFiltersStore((s) => s.getDeveloperLoginsForApi);
  const developerLoginsParam = getDeveloperLoginsForApi();
  const hasNoReposSelected = useFiltersStore((s) => s.hasNoReposSelected);
  const noReposSelected = hasNoReposSelected();
  const { startDate, endDate } = getStartEnd();

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

  if (noReposSelected) {
    return (
      <div className="code-review-prs-screen">
        <h1 className="screen-title">PRs</h1>
        <EmptyState
          title="No repositories selected"
          message="Select at least one repository in the filter above to see pull requests."
        />
      </div>
    );
  }

  if (prHealth.isLoading && !prHealth.data) {
    return (
      <div className="code-review-prs-screen">
        <h1 className="screen-title">PRs</h1>
        <SkeletonCard />
      </div>
    );
  }

  if (prHealth.error) {
    return (
      <div className="code-review-prs-screen">
        <h1 className="screen-title">PRs</h1>
        <div className="error">{(prHealth.error as Error).message}</div>
      </div>
    );
  }

  const data = prHealth.data as {
    pr_health_scores?: Array<{
      pr_id: number;
      pr_number?: number;
      title?: string;
      health_score: number;
      health_category?: string;
    }>;
  } | undefined;
  const scores = data?.pr_health_scores ?? [];

  const categoryOrder = ['Healthy', 'Needs attention', 'At risk', 'Other'];
  const byCategory = scores.reduce<Record<string, typeof scores>>((acc, pr) => {
    const key = pr.health_category?.trim() || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(pr);
    return acc;
  }, {});
  const orderedCategories = [
    ...categoryOrder.filter((c) => byCategory[c]?.length),
    ...Object.keys(byCategory).filter((c) => !categoryOrder.includes(c)),
  ];

  return (
    <div className="code-review-prs-screen">
      <h1 className="screen-title">PRs</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div className="card">
        <div className="card__title">Pull requests</div>
        {scores.length === 0 ? (
          <div className="empty-state">No PRs in this period.</div>
        ) : (
          <div className="code-review-prs__accordion data-coverage__accordion">
            {orderedCategories.map((category) => {
              const prs = byCategory[category] ?? [];
              const accent =
                category === 'Healthy'
                  ? 'var(--metric-green)'
                  : category === 'Needs attention'
                    ? 'var(--metric-orange)'
                    : category === 'At risk'
                      ? 'var(--metric-orange)'
                      : 'var(--text-muted)';
              return (
                <details
                  key={category}
                  className="data-coverage__accordion-item"
                  style={{ '--connector-accent': accent } as CSSProperties}
                >
                  <summary className="data-coverage__accordion-summary">
                    <span className="data-coverage__connector-dot" />
                    <div className="data-coverage__connector-info">
                      <span className="data-coverage__connector-name">{category}</span>
                      <span className="data-coverage__connector-sync">
                        {prs.length} PR{prs.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="data-coverage__accordion-chevron" aria-hidden />
                  </summary>
                  <div className="data-coverage__accordion-body">
                    <div className="code-review-prs__list">
                      {prs.map((pr) => (
                        <PRRowAccordion key={pr.pr_id} pr={pr} />
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
