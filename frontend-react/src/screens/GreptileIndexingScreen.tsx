import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGreptileRepos,
  getGreptileRepoDetails,
  getSettings,
  refreshGreptileStatus,
} from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import type { GreptileManagedRepo, GreptileRepoDetailsResponse } from '@/types/index.js';

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

  const refreshMutation = useMutation({
    mutationFn: () => refreshGreptileStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['greptile', 'repos'] });
      queryClient.invalidateQueries({ queryKey: ['greptile', 'metrics'] });
    },
  });

  // Periodic "Refresh status" when there are errors or processing (not too often)
  const refreshIntervalMs = 2.5 * 60 * 1000;
  useEffect(() => {
    if (!reposData?.repos) return;
    const failed = reposData.repos.filter((r) => r.index_status === 'error').length;
    const processing = reposData.repos.filter((r) => r.index_status === 'processing').length;
    if (failed === 0 && processing === 0) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshMutation.mutate();
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [reposData?.repos, refreshIntervalMs, refreshMutation]);

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
      queueMicrotask(() => setStatusFilter(new Set([statusFromUrl])));
    }
  }, [statusFromUrl]);

  // Error details fetched on demand for failed repos
  const [errorDetails, setErrorDetails] = useState<Record<string, { loading?: boolean; error?: string; data?: GreptileRepoDetailsResponse }>>({});

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
  }, [reposData, sortKey, sortAsc, repoSearch, statusFilter]);

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
  }, [reposData]);

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
        <h1 className="screen-title">Repository indexing status</h1>
        <PageSummary>Indexing status for Greptile (read-only)</PageSummary>
        <EmptyState
          title="Greptile not connected"
          message="Add your Greptile API key in Settings to view indexing status."
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
      <h1 className="screen-title">Repository indexing status</h1>

      <div className="greptile-indexing__intro-box">
        <p className="greptile-indexing__intro-box-summary">Indexing status from Greptile (read-only)</p>
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
          Veelocity only fetches and displays indexing status from Greptile. It does not trigger indexing. Status reflects the <strong>last sync</strong>. Use <strong>Refresh status</strong> to fetch the latest. To index or re-index repositories, use the <a href="https://app.greptile.com" target="_blank" rel="noopener noreferrer">Greptile app</a>.
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
      </div>

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

function StatusBadge({
  status,
  titleOverride,
  colorOverride,
}: {
  status: string | null;
  titleOverride?: string;
  colorOverride?: string;
}) {
  const config = getStatusConfig(status);
  const color = colorOverride ?? config.color;
  const title =
    titleOverride ??
    (status === 'processing'
      ? 'Queued or in progress as of last sync. Click Refresh status to get the latest.'
      : status === 'error'
        ? 'Indexing failed. Use "View error details" in the row to see why.'
        : status === 'stale'
          ? 'List may be from an earlier sync. Use Refresh status to update.'
          : status === 'not_found'
            ? 'Repo not present in Greptile (checked via API). Use Index to add it.'
            : undefined);
  return (
    <span
      className="greptile-indexing__status-badge"
      title={title}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
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
  errorDetails,
  onFetchErrorDetails,
  onClearErrorDetails,
}: {
  repo: GreptileManagedRepo;
  errorDetails?: { loading?: boolean; error?: string; data?: GreptileRepoDetailsResponse };
  onFetchErrorDetails: () => void;
  onClearErrorDetails: () => void;
}) {
  const isProcessing = repo.index_status === 'processing';
  const isFailed = repo.index_status === 'error';
  const hasErrorDetails = errorDetails?.data != null || errorDetails?.error != null;
  const liveSuccessLike =
    hasErrorDetails &&
    errorDetails?.data?.status != null &&
    SUCCESS_LIKE_STATUSES.has((errorDetails.data.status as string).toLowerCase());
  const displayStatus: string | null =
    isFailed && liveSuccessLike ? 'stale' : repo.index_status;
  const showErrorRow = isFailed && (errorDetails?.loading || hasErrorDetails);

  return (
    <>
      <tr style={{ borderBottom: showErrorRow ? 'none' : undefined }}>
        <td>
          <div style={{ fontWeight: 500 }}>{repo.repository}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {repo.greptile_branch || repo.default_branch || 'main'}
          </div>
        </td>
        <td>
          <StatusBadge
            status={displayStatus}
            titleOverride={
              displayStatus === 'stale' && liveSuccessLike
                ? 'List showed error at last sync; Greptile now reports completed. Use Refresh status to update.'
                : undefined
            }
            colorOverride={
              displayStatus === 'stale' && liveSuccessLike ? 'var(--metric-blue)' : undefined
            }
          />
          {isFailed && !liveSuccessLike && repo.greptile_status && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 6 }}>
              ({repo.greptile_status})
            </span>
          )}
          {displayStatus === 'stale' && liveSuccessLike && errorDetails?.data?.status && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--metric-blue)', marginLeft: 6 }}>
              (Greptile: {errorDetails.data.status})
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
        </td>
      </tr>
      {showErrorRow && (
        <tr className="greptile-indexing__table-feedback-row">
          <td colSpan={5} style={{ padding: '0 16px 12px', verticalAlign: 'top', borderBottom: '1px solid var(--surface-border)' }}>
            <ErrorDetailsContent errorDetails={errorDetails} onRefreshHint={true} />
          </td>
        </tr>
      )}
    </>
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
