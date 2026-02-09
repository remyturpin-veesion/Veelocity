import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGreptileRepos,
  getSettings,
  indexAllGreptileRepos,
  indexGreptileRepo,
  refreshGreptileStatus,
} from '@/api/endpoints.js';
import { EmptyState } from '@/components/EmptyState.js';
import type { GreptileManagedRepo } from '@/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string; priority: number }> = {
  completed: { label: 'Indexed', color: 'var(--metric-green)', priority: 5 },
  submitted: { label: 'Submitted', color: 'var(--metric-blue)', priority: 4 },
  processing: { label: 'Processing', color: 'var(--metric-blue)', priority: 3 },
  cloning: { label: 'Cloning', color: 'var(--metric-blue)', priority: 2 },
  failed: { label: 'Failed', color: 'var(--metric-orange)', priority: 1 },
};

function getStatusConfig(status: string | null) {
  if (!status) return { label: 'Not indexed', color: 'var(--text-muted)', priority: 0 };
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

type RepoSortKey = 'repository' | 'greptile_status' | 'files_processed' | 'synced_at';

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

  // Sorting & search
  const [sortKey, setSortKey] = useState<RepoSortKey>('greptile_status');
  const [sortAsc, setSortAsc] = useState(true);
  const [repoSearch, setRepoSearch] = useState('');

  // Indexing tracking
  const [indexingRepos, setIndexingRepos] = useState<Set<string>>(new Set());

  const handleIndexRepo = useCallback(
    (repo: GreptileManagedRepo, reload: boolean) => {
      setIndexingRepos((prev) => new Set(prev).add(repo.repository));
      indexMutation.mutate(
        {
          repository: repo.repository,
          branch: repo.greptile_branch || repo.default_branch || 'main',
          reload,
        },
        {
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
    [indexMutation]
  );

  const handleIndexAll = useCallback(
    (reload: boolean) => {
      indexAllMutation.mutate({ reload });
    },
    [indexAllMutation]
  );

  const sortedRepos = useMemo(() => {
    if (!reposData?.repos) return [];
    let rows = [...reposData.repos];
    // Filter by search
    const q = repoSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.repository.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'repository') {
        cmp = a.repository.localeCompare(b.repository);
      } else if (sortKey === 'greptile_status') {
        const pa = getStatusConfig(a.greptile_status).priority;
        const pb = getStatusConfig(b.greptile_status).priority;
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
  }, [reposData?.repos, sortKey, sortAsc, repoSearch]);

  const repoStats = useMemo(() => {
    if (!reposData?.repos) return { indexed: 0, processing: 0, notIndexed: 0, failed: 0, total: 0 };
    const repos = reposData.repos;
    return {
      indexed: repos.filter((r) => r.greptile_status === 'completed').length,
      processing: repos.filter((r) => ['submitted', 'processing', 'cloning'].includes(r.greptile_status || '')).length,
      notIndexed: repos.filter((r) => !r.greptile_status).length,
      failed: repos.filter((r) => r.greptile_status === 'failed').length,
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="screen-title" style={{ marginBottom: 0 }}>Repository Indexing</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              borderRadius: 8,
              border: '1px solid var(--surface-border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: refreshMutation.isPending ? 'wait' : 'pointer',
              opacity: refreshMutation.isPending ? 0.6 : 1,
            }}
          >
            {refreshMutation.isPending ? 'Refreshing\u2026' : 'Refresh status'}
          </button>
          <a
            href="https://app.greptile.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              borderRadius: 8,
              border: '1px solid var(--surface-border)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Greptile app &#8599;
          </a>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>
        Manage which repositories are indexed in Greptile for AI code review.
      </p>

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatBadge label="Indexed" count={repoStats.indexed} color="var(--metric-green)" />
          <StatBadge label="Processing" count={repoStats.processing} color="var(--metric-blue)" />
          <StatBadge label="Not indexed" count={repoStats.notIndexed} color="var(--text-muted)" />
          {repoStats.failed > 0 && <StatBadge label="Failed" count={repoStats.failed} color="var(--metric-orange)" />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {repoStats.notIndexed > 0 && (
            <button
              type="button"
              onClick={() => handleIndexAll(false)}
              disabled={indexAllMutation.isPending}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: 6,
                border: '1px solid var(--primary)',
                background: 'var(--primary)',
                color: '#fff',
                cursor: indexAllMutation.isPending ? 'wait' : 'pointer',
                opacity: indexAllMutation.isPending ? 0.6 : 1,
              }}
            >
              {indexAllMutation.isPending ? 'Indexing\u2026' : `Index all (${repoStats.notIndexed} missing)`}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleIndexAll(true)}
            disabled={indexAllMutation.isPending}
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 500,
              borderRadius: 6,
              border: '1px solid var(--surface-border)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              cursor: indexAllMutation.isPending ? 'wait' : 'pointer',
              opacity: indexAllMutation.isPending ? 0.6 : 1,
            }}
          >
            Re-index all
          </button>
        </div>
      </div>

      {/* Index All result toast */}
      {indexAllMutation.isSuccess && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            fontSize: '0.8125rem',
            color: 'var(--metric-green)',
          }}
        >
          Indexing submitted for {indexAllMutation.data.submitted} repos
          {indexAllMutation.data.errors > 0 && ` (${indexAllMutation.data.errors} errors)`}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchInput value={repoSearch} onChange={setRepoSearch} placeholder="Search repositories\u2026" />
      </div>

      {/* Repository table */}
      {isLoading ? (
        <div className="loading">Loading repositories\u2026</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', textAlign: 'left' }}>
                  <SortableTh label="Repository" sortKey="repository" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableTh label="Status" sortKey="greptile_status" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Progress</th>
                  <SortableTh label="Last sync" sortKey="synced_at" currentSort={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRepos.map((repo) => (
                  <RepoRow
                    key={repo.repository}
                    repo={repo}
                    isIndexing={indexingRepos.has(repo.repository)}
                    onIndex={(reload) => handleIndexRepo(repo, reload)}
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
        </div>
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: '0.8125rem',
        fontWeight: 500,
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

function StatusBadge({ status }: { status: string | null }) {
  const config = getStatusConfig(status);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 500,
        color: config.color,
        background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}

function ProgressBar({ processed, total }: { processed: number | null; total: number | null }) {
  if (processed == null || total == null || total === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{'\u2014'}</span>;
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
}: {
  repo: GreptileManagedRepo;
  isIndexing: boolean;
  onIndex: (reload: boolean) => void;
}) {
  const isProcessing = ['submitted', 'processing', 'cloning'].includes(repo.greptile_status || '');
  const isCompleted = repo.greptile_status === 'completed';
  const isFailed = repo.greptile_status === 'failed';
  const isNotIndexed = !repo.greptile_status;

  return (
    <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 500 }}>{repo.repository}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {repo.greptile_branch || repo.default_branch || 'main'}
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <StatusBadge status={repo.greptile_status} />
      </td>
      <td style={{ padding: '10px 12px' }}>
        <ProgressBar processed={repo.files_processed} total={repo.num_files} />
      </td>
      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {fmtTimeAgo(repo.synced_at)}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {(isNotIndexed || isFailed) && (
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
          {isIndexing && <Spinner />}
        </div>
      </td>
    </tr>
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

function SortableTh({
  label,
  sortKey: key,
  currentSort,
  asc,
  onSort,
}: {
  label: string;
  sortKey: RepoSortKey;
  currentSort: RepoSortKey;
  asc: boolean;
  onSort: (k: RepoSortKey) => void;
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
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '5px 12px',
        fontSize: '0.8125rem',
        borderRadius: 6,
        border: '1px solid var(--surface-border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        width: 220,
        outline: 'none',
      }}
    />
  );
}

export default GreptileIndexingScreen;
