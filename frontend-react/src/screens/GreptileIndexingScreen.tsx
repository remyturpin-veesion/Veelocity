import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGreptileRepos,
  getGreptileRepoDetails,
  getSettings,
  indexAllGreptileRepos,
  indexGreptileRepo,
  refreshGreptileStatus,
} from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import type { GreptileManagedRepo, GreptileIndexResult, GreptileRepoDetailsResponse } from '@/types/index.js';

// ---------------------------------------------------------------------------
// Per-repo feedback
// ---------------------------------------------------------------------------

interface RepoFeedback {
  type: 'success' | 'error';
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derived index_status values — aligned with the Greptile overview screen. */
const STATUS_CONFIG: Record<string, { label: string; color: string; priority: number }> = {
  indexed: { label: 'Indexed', color: 'var(--metric-green)', priority: 5 },
  active: { label: 'Active', color: 'var(--metric-blue)', priority: 4 },
  processing: { label: 'Processing', color: 'var(--metric-blue)', priority: 3 },
  stale: { label: 'Stale', color: 'var(--metric-orange)', priority: 2 },
  error: { label: 'Error', color: 'var(--metric-orange)', priority: 1 },
  not_found: { label: 'Not found', color: 'var(--text-muted)', priority: 0 },
  not_indexed: { label: 'Not indexed', color: 'var(--text-muted)', priority: 0 },
};

function getStatusConfig(status: string | null) {
  if (!status) return STATUS_CONFIG.not_indexed;
  return STATUS_CONFIG[status] ?? { label: status, color: 'var(--text-muted)', priority: 0 };
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  return `${v}%`;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  return v.toLocaleString();
}

function fmtTimeAgo(iso: string | null): string {
  if (!iso) return '\u2014';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  } catch {
    return iso;
  }
}

type RepoSortKey = 'repository' | 'index_status' | 'files_processed' | 'synced_at';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GreptileIndexingScreen() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data: reposData, isLoading } = useQuery({
    queryKey: ['greptile', 'repos'],
    queryFn: getGreptileRepos,
    refetchInterval: 30_000,
  });

  // Mutations
  const indexMutation = useMutation({
    mutationFn: indexGreptileRepo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greptile', 'repos'] });
    },
  });

  const indexAllMutation = useMutation({
    mutationFn: indexAllGreptileRepos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greptile', 'repos'] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshGreptileStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greptile', 'repos'] });
      queryClient.invalidateQueries({ queryKey: ['greptile', 'metrics'] });
    },
  });

  // URL: ?status=not_found (or other status) to open with filter applied
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status');

  // Sorting & search
  const [sortKey, setSortKey] = useState<RepoSortKey>('index_status');
  const [sortAsc, setSortAsc] = useState(true);
  const [repoSearch, setRepoSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() =>
    statusFromUrl && STATUS_CONFIG[statusFromUrl] ? new Set([statusFromUrl]) : new Set()
  );

  // Keep filter in sync with URL when navigating with ?status=...
  useEffect(() => {
    if (statusFromUrl && STATUS_CONFIG[statusFromUrl]) {
      setStatusFilter(new Set([statusFromUrl]));
    }
  }, [statusFromUrl]);

  // Indexing tracking
  const [indexingRepos, setIndexingRepos] = useState<Set<string>>(new Set());

  // Per-repo feedback (success / error toasts)
  const [repoFeedback, setRepoFeedback] = useState<Record<string, RepoFeedback>>({});
  const feedbackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Error details fetched on demand for failed repos
  const [errorDetails, setErrorDetails] = useState<Record<string, { loading?: boolean; error?: string; data?: GreptileRepoDetailsResponse }>>({});

  // Clean up timers on unmount
  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const setFeedbackForRepo = useCallback((repo: string, fb: RepoFeedback) => {
    setRepoFeedback((prev) => ({ ...prev, [repo]: fb }));
    // Clear any existing timer
    if (feedbackTimers.current[repo]) {
      clearTimeout(feedbackTimers.current[repo]);
    }
    // Auto-dismiss success after 8s, errors persist longer (15s)
    const delay = fb.type === 'success' ? 8_000 : 15_000;
    feedbackTimers.current[repo] = setTimeout(() => {
      setRepoFeedback((prev) => {
        const next = { ...prev };
        delete next[repo];
        return next;
      });
      delete feedbackTimers.current[repo];
    }, delay);
  }, []);

  const clearFeedbackForRepo = useCallback((repo: string) => {
    setRepoFeedback((prev) => {
      const next = { ...prev };
      delete next[repo];
      return next;
    });
    if (feedbackTimers.current[repo]) {
      clearTimeout(feedbackTimers.current[repo]);
      delete feedbackTimers.current[repo];
    }
  }, []);

  const handleIndexRepo = useCallback(
    (repo: GreptileManagedRepo, reload: boolean) => {
      setIndexingRepos((prev) => new Set(prev).add(repo.repository));
      clearFeedbackForRepo(repo.repository);
      indexMutation.mutate(
        {
          repository: repo.repository,
          branch: repo.greptile_branch || repo.default_branch || 'main',
          reload,
        },
        {
          onSuccess: (data: GreptileIndexResult) => {
            if (data.status === 'error') {
              const detail = data.error_detail || data.error_code || 'Unknown error';
              setFeedbackForRepo(repo.repository, {
                type: 'error',
                message: `Indexing failed: ${detail}`,
              });
            } else if (data.status === 'not_found') {
              setFeedbackForRepo(repo.repository, {
                type: 'success',
                message: data.message || 'Repo not in Greptile. Use Index to add it.',
              });
            } else {
              setFeedbackForRepo(repo.repository, {
                type: 'success',
                message: data.message || 'Indexing submitted',
              });
            }
          },
          onError: (err: Error) => {
            setFeedbackForRepo(repo.repository, {
              type: 'error',
              message: `Request failed: ${err.message}`,
            });
          },
          onSettled: () => {
            setIndexingRepos((prev) => {
              const next = new Set(prev);
              next.delete(repo.repository);
              return next;
            });
          },
        }
      );
    },
    [indexMutation, setFeedbackForRepo, clearFeedbackForRepo]
  );

  const handleIndexAll = useCallback(
    (reload: boolean) => {
      indexAllMutation.mutate({ reload });
    },
    [indexAllMutation]
  );

  const handleFetchErrorDetails = useCallback((repo: GreptileManagedRepo) => {
    const key = repo.repository;
    setErrorDetails((prev) => {
      if (prev[key]?.data != null || prev[key]?.loading) return prev;
      return { ...prev, [key]: { loading: true } };
    });
    getGreptileRepoDetails({
      repository: repo.repository,
      branch: repo.greptile_branch || repo.default_branch || undefined,
    })
      .then((data) => {
        setErrorDetails((prev) => ({ ...prev, [key]: { data } }));
      })
      .catch((err: Error) => {
        setErrorDetails((prev) => ({ ...prev, [key]: { error: err.message } }));
      });
  }, []);

  const clearErrorDetails = useCallback((repo: string) => {
    setErrorDetails((prev) => {
      const next = { ...prev };
      delete next[repo];
      return next;
    });
  }, []);

  const sortedRepos = useMemo(() => {
    if (!reposData?.repos) return [];
    let rows = [...reposData.repos];
    // Filter by search
    const q = repoSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.repository.toLowerCase().includes(q));
    }
    // Filter by status (empty set = show all)
    if (statusFilter.size > 0) {
      rows = rows.filter((r) => statusFilter.has(r.index_status ?? 'not_indexed'));
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'repository') {
        cmp = a.repository.localeCompare(b.repository);
      } else if (sortKey === 'index_status') {
        const pa = getStatusConfig(a.index_status).priority;
        const pb = getStatusConfig(b.index_status).priority;
        cmp = pa - pb;
      } else if (sortKey === 'files_processed') {
        const va = a.files_processed ?? -1;
        const vb = b.files_processed ?? -1;
        cmp = va - vb;
      } else if (sortKey === 'synced_at') {
        const va = a.synced_at ? new Date(a.synced_at).getTime() : 0;
        const vb = b.synced_at ? new Date(b.synced_at).getTime() : 0;
        cmp = va - vb;
      }
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [reposData?.repos, sortKey, sortAsc, repoSearch, statusFilter]);

  const repoStats = useMemo(() => {
    if (!reposData?.repos) return { indexed: 0, active: 0, processing: 0, notIndexed: 0, notFound: 0, failed: 0, stale: 0, total: 0 };
    const repos = reposData.repos;
    return {
      indexed: repos.filter((r) => r.index_status === 'indexed').length,
      processing: repos.filter((r) => r.index_status === 'processing').length,
      active: repos.filter((r) => r.index_status === 'active').length,
      notIndexed: repos.filter((r) => r.index_status === 'not_indexed').length,
      notFound: repos.filter((r) => r.index_status === 'not_found').length,
      failed: repos.filter((r) => r.index_status === 'error').length,
      stale: repos.filter((r) => r.index_status === 'stale').length,
      total: repos.length,
    };
  }, [reposData?.repos]);

  function handleSort(key: RepoSortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  // ---- Not configured ----
  if (settings?.greptile_configured !== true && settings?.github_configured !== true) {
    return (
      <div>
        <h1 className="screen-title">Repository Indexing</h1>
        <PageSummary>Repository indexing status for Greptile</PageSummary>
        <EmptyState
          title="Greptile not connected"
          message="Add your Greptile API key in Settings to manage repository indexing."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  return (
    <div className="greptile-indexing">
      <h1 className="screen-title">Repository Indexing</h1>

      <div className="greptile-indexing__intro-box">
        <p className="greptile-indexing__intro-box-summary">Repository indexing status for Greptile</p>
        <div className="greptile-indexing__intro-box-actions">
          <button
            type="button"
            className="greptile-indexing__btn"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? 'Refreshing…' : 'Refresh status'}
          </button>
          <a
            href="https://app.greptile.com"
            target="_blank"
            rel="noopener noreferrer"
            className="greptile-indexing__btn greptile-indexing__btn--outline"
          >
            Greptile app &#8599;
          </a>
        </div>
        <p className="greptile-indexing__intro-box-desc">
          Manage which repositories are indexed in Greptile for AI code review. Status and progress reflect the <strong>last sync</strong> with Greptile (not live). Use <strong>Refresh status</strong> to fetch the latest; progress may only appear once indexing completes. <strong>Processing</strong> means Greptile reported the repo as queued or in progress as of that last sync — if it stays that way, click Refresh status to update.
        </p>
      </div>

      <div className="greptile-indexing__summary">
        <div className="greptile-indexing__summary-badges">
          <StatBadge label="Indexed" count={repoStats.indexed} color="var(--metric-green)" />
          {repoStats.active > 0 && <StatBadge label="Active" count={repoStats.active} color="var(--metric-blue)" />}
          {repoStats.processing > 0 && <StatBadge label="Processing" count={repoStats.processing} color="var(--metric-blue)" />}
          <StatBadge label="Not indexed" count={repoStats.notIndexed} color="var(--text-muted)" />
          {repoStats.notFound > 0 && <StatBadge label="Not found" count={repoStats.notFound} color="var(--text-muted)" />}
          {repoStats.stale > 0 && <StatBadge label="Stale" count={repoStats.stale} color="var(--metric-orange)" />}
          {repoStats.failed > 0 && <StatBadge label="Error" count={repoStats.failed} color="var(--metric-orange)" />}
        </div>
        <div className="greptile-indexing__summary-actions">
          {(repoStats.notIndexed > 0 || repoStats.notFound > 0) && (
            <button
              type="button"
              className="greptile-indexing__btn greptile-indexing__btn--primary"
              onClick={() => handleIndexAll(false)}
              disabled={indexAllMutation.isPending}
            >
              {indexAllMutation.isPending ? 'Indexing…' : `Index all (${repoStats.notIndexed + repoStats.notFound} missing)`}
            </button>
          )}
          <button
            type="button"
            className="greptile-indexing__btn greptile-indexing__btn--outline"
            onClick={() => handleIndexAll(true)}
            disabled={indexAllMutation.isPending}
          >
            Re-index all
          </button>
        </div>
      </div>

      {indexAllMutation.isSuccess && (
        <div
          className={`greptile-indexing__toast ${indexAllMutation.data.errors > 0 ? 'greptile-indexing__toast--error' : 'greptile-indexing__toast--success'}`}
        >
          Indexing submitted for {indexAllMutation.data.submitted} repos
          {indexAllMutation.data.errors > 0 && ` (${indexAllMutation.data.errors} failed)`}
        </div>
      )}
      {indexAllMutation.isError && (
        <div className="greptile-indexing__toast greptile-indexing__toast--error">
          Index all failed: {(indexAllMutation.error as Error)?.message || 'Unknown error'}
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading repositories…</div>
      ) : (
        <>
          <div className="greptile-indexing__table-toolbar">
            <SearchInput value={repoSearch} onChange={setRepoSearch} placeholder="Filter repositories…" />
            <StatusFilterPills
              options={Object.entries(STATUS_CONFIG).map(([value, config]) => ({
                value,
                label: config.label,
                color: config.color,
              }))}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          <div className="greptile-indexing__table-wrap">
            <table className="greptile-indexing__table">
              <thead>
                <tr>
                  <th role="button" tabIndex={0} onClick={() => handleSort('repository')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('repository')}>
                    Repository {sortKey === 'repository' && (sortAsc ? '\u25B2' : '\u25BC')}
                  </th>
                  <th role="button" tabIndex={0} onClick={() => handleSort('index_status')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('index_status')}>
                    Status {sortKey === 'index_status' && (sortAsc ? '\u25B2' : '\u25BC')}
                  </th>
                  <th>Progress</th>
                  <th role="button" tabIndex={0} onClick={() => handleSort('synced_at')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('synced_at')}>
                    Last sync {sortKey === 'synced_at' && (sortAsc ? '\u25B2' : '\u25BC')}
                  </th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRepos.map((repo) => (
                  <RepoRow
                    key={repo.repository}
                    repo={repo}
                    isIndexing={indexingRepos.has(repo.repository)}
                    onIndex={(reload) => handleIndexRepo(repo, reload)}
                    feedback={repoFeedback[repo.repository] ?? null}
                    onDismissFeedback={() => clearFeedbackForRepo(repo.repository)}
                    errorDetails={errorDetails[repo.repository]}
                    onFetchErrorDetails={() => handleFetchErrorDetails(repo)}
                    onClearErrorDetails={() => clearErrorDetails(repo.repository)}
                  />
                ))}
                {sortedRepos.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No repositories found. Make sure GitHub is connected and synced.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      className="greptile-indexing__stat-badge"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <span style={{ fontWeight: 700 }}>{count}</span>
      {label}
    </div>
  );
}

/** Live API statuses that indicate success; if we see these but the list shows Error, the list is likely stale. */
const SUCCESS_LIKE_STATUSES = new Set(['completed', 'indexed', 'submitted']);

function ErrorDetailsContent({
  errorDetails,
  onRefreshHint,
}: {
  errorDetails?: { loading?: boolean; error?: string; data?: GreptileRepoDetailsResponse };
  onRefreshHint?: boolean;
}) {
  if (!errorDetails) return null;
  if (errorDetails.loading) {
    return <span>Fetching error details…</span>;
  }
  if (errorDetails.error) {
    return (
      <span>
        Could not load details: {errorDetails.error}
      </span>
    );
  }
  const data = errorDetails.data;
  if (!data) return null;

  const statusLower = (data.status ?? '').toLowerCase();
  const isSuccessLike = SUCCESS_LIKE_STATUSES.has(statusLower);
  const isNotFound = data.status === 'not_found';

  const useErrorStyle = !isNotFound && !isSuccessLike;
  const useInfoStyle = isSuccessLike && !data.error_message;

  const style = isNotFound
    ? {
        background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--text-muted) 25%, transparent)',
        color: 'var(--text-muted)',
      }
    : useInfoStyle
      ? {
          background: 'color-mix(in srgb, var(--metric-blue) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--metric-blue) 25%, transparent)',
          color: 'var(--metric-blue)',
        }
      : {
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: 'var(--metric-orange)',
        };

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        fontSize: '0.75rem',
        ...style,
      }}
    >
      {isNotFound && (
        <span>{data.message ?? 'Repo not present in Greptile. Use Index to add it.'}</span>
      )}
      {!isNotFound && data.error_message && (
        <div>
          <strong>Error from Greptile:</strong>
          <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.6875rem' }}>
            {data.error_message}
          </pre>
        </div>
      )}
      {!isNotFound && !data.error_message && data.message && (
        <span>{data.message}</span>
      )}
      {!isNotFound && !data.error_message && !data.message && isSuccessLike && (
        <span>
          Greptile currently reports status: <strong>{data.status ?? 'unknown'}</strong>. The list above may be from an
          earlier sync.
          {onRefreshHint && (
            <> Use <strong>Refresh status</strong> to update.</>
          )}
        </span>
      )}
      {!isNotFound && !data.error_message && !data.message && !isSuccessLike && (
        <span>Status: {data.status ?? 'unknown'} (no message returned)</span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const config = getStatusConfig(status);
  const title =
    status === 'processing'
      ? 'Queued or in progress as of last sync. Click Refresh status to get the latest.'
      : status === 'error'
        ? 'Indexing failed. Use "View error details" in the row to see why.'
        : status === 'not_found'
          ? 'Repo not present in Greptile (checked via API). Use Index to add it.'
          : undefined;
  return (
    <span
      className="greptile-indexing__status-badge"
      title={title}
      style={{
        color: config.color,
        background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}

function ProgressBar({
  processed,
  total,
  titleWhenEmpty,
}: {
  processed: number | null;
  total: number | null;
  titleWhenEmpty?: string;
}) {
  if (processed == null || total == null || total === 0) {
    return (
      <span
        style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
        title={titleWhenEmpty}
      >
        {'\u2014'}
      </span>
    );
  }
  const pct = Math.round((processed / total) * 100);
  const barColor =
    pct >= 90
      ? 'var(--metric-green)'
      : pct >= 50
        ? 'var(--metric-orange)'
        : 'var(--text-muted)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
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
        {fmtPct(pct)} ({fmtNum(processed)}/{fmtNum(total)})
      </span>
    </div>
  );
}

function RepoRow({
  repo,
  isIndexing,
  onIndex,
  feedback,
  onDismissFeedback,
  errorDetails,
  onFetchErrorDetails,
  onClearErrorDetails,
}: {
  repo: GreptileManagedRepo;
  isIndexing: boolean;
  onIndex: (reload: boolean) => void;
  feedback: RepoFeedback | null;
  onDismissFeedback: () => void;
  errorDetails?: { loading?: boolean; error?: string; data?: GreptileRepoDetailsResponse };
  onFetchErrorDetails: () => void;
  onClearErrorDetails: () => void;
}) {
  const isProcessing = repo.index_status === 'processing';
  const isCompleted = repo.index_status === 'indexed';
  const isFailed = repo.index_status === 'error';
  const isNotFound = repo.index_status === 'not_found';
  const isNotIndexed = repo.index_status === 'not_indexed';
  const isActive = repo.index_status === 'active';
  const hasErrorDetails = errorDetails?.data != null || errorDetails?.error != null;
  const showErrorRow = isFailed && (errorDetails?.loading || hasErrorDetails);

  return (
    <>
      <tr style={{ borderBottom: feedback || showErrorRow ? 'none' : undefined }}>
        <td>
          <div style={{ fontWeight: 500 }}>{repo.repository}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {repo.greptile_branch || repo.default_branch || 'main'}
          </div>
        </td>
        <td>
          <StatusBadge status={repo.index_status} />
          {isFailed && repo.greptile_status && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 6 }}>
              ({repo.greptile_status})
            </span>
          )}
        </td>
        <td>
          <ProgressBar
            processed={repo.files_processed}
            total={repo.num_files}
            titleWhenEmpty={
              isProcessing
                ? 'Progress may not be reported until indexing completes. Use Refresh status to update.'
                : undefined
            }
          />
        </td>
        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {fmtTimeAgo(repo.synced_at)}
        </td>
        <td style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {(isNotIndexed || isNotFound || isFailed || isActive) && (
              <ActionButton label="Index" onClick={() => onIndex(false)} disabled={isIndexing} variant="primary" />
            )}
            {isProcessing && (
              <span style={{ fontSize: '0.75rem', color: 'var(--metric-blue)', fontStyle: 'italic' }}>
                {isIndexing ? 'Submitting\u2026' : 'Processing\u2026'}
              </span>
            )}
            {(isCompleted || isFailed) && (
              <ActionButton label="Re-index" onClick={() => onIndex(true)} disabled={isIndexing} variant="secondary" />
            )}
            {isNotFound && (
              <ActionButton label="Re-index" onClick={() => onIndex(true)} disabled={isIndexing} variant="secondary" />
            )}
            {isFailed && (
              <button
                type="button"
                onClick={() => (hasErrorDetails ? onClearErrorDetails() : onFetchErrorDetails())}
                disabled={errorDetails?.loading}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  borderRadius: 5,
                  border: '1px solid var(--surface-border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: errorDetails?.loading ? 'wait' : 'pointer',
                  opacity: errorDetails?.loading ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {errorDetails?.loading ? 'Loading…' : hasErrorDetails ? 'Hide details' : 'View error details'}
              </button>
            )}
            {isIndexing && <Spinner />}
          </div>
        </td>
      </tr>
      {showErrorRow && (
        <tr className="greptile-indexing__table-feedback-row">
          <td colSpan={5} style={{ padding: '0 16px 12px', verticalAlign: 'top', borderBottom: '1px solid var(--surface-border)' }}>
            <ErrorDetailsContent errorDetails={errorDetails} onRefreshHint={true} />
          </td>
        </tr>
      )}
      {feedback && (
        <tr className="greptile-indexing__table-feedback-row">
          <td colSpan={5} style={{ padding: '0 16px 12px', verticalAlign: 'top', borderBottom: '1px solid var(--surface-border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.75rem',
                background:
                  feedback.type === 'error'
                    ? 'rgba(239, 68, 68, 0.08)'
                    : 'rgba(34, 197, 94, 0.08)',
                border:
                  feedback.type === 'error'
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid rgba(34, 197, 94, 0.3)',
                color:
                  feedback.type === 'error'
                    ? 'var(--metric-orange)'
                    : 'var(--metric-green)',
              }}
            >
              <span>{feedback.message}</span>
              <button
                type="button"
                onClick={onDismissFeedback}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: 1,
                  padding: '0 4px',
                  opacity: 0.7,
                }}
                aria-label="Dismiss"
              >
                &times;
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        fontSize: '0.6875rem',
        fontWeight: 500,
        borderRadius: 5,
        border: isPrimary ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
        background: isPrimary ? 'var(--primary)' : 'transparent',
        color: isPrimary ? '#fff' : 'var(--text-muted)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid var(--surface-border)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

function StatusFilterPills({
  options,
  selected,
  onChange,
}: {
  options: Array<{ value: string; label: string; color: string }>;
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const toggle = (value: string) => {
    if (selected.size === 0) {
      const next = new Set(options.map((o) => o.value));
      next.delete(value);
      onChange(next);
    } else {
      const next = new Set(selected);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      onChange(next);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map(({ value, label, color }) => {
        const isActive = selected.size === 0 || selected.has(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            style={{
              padding: '2px 8px',
              fontSize: '0.6875rem',
              fontWeight: 500,
              borderRadius: 999,
              border: `1px solid ${isActive ? `color-mix(in srgb, ${color} 40%, transparent)` : 'var(--surface-border)'}`,
              background: isActive ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
              color: isActive ? color : 'var(--text-muted)',
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.7,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="greptile-indexing__search"
      aria-label="Filter repositories"
    />
  );
}

export default GreptileIndexingScreen;
