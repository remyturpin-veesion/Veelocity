import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFiltersStore, formatDateRangeDisplay, TEAM_ID_NONE } from '@/stores/filters.js';
import { getLinearOverview, getSyncCoverage, getSyncStatus, triggerLinearFullSync } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 60) return `${mins} minutes ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function LinearOverviewScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();
  useFiltersStore((s) => s.teamIds); // subscribe so we re-render when team filter changes
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const teamIdsParam = getTeamIdsForApi();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['linear', 'overview', startDate, endDate, teamIdsParam],
    queryFn: () =>
      getLinearOverview({
        start_date: startDate,
        end_date: endDate,
        team_ids:
          teamIdsParam && teamIdsParam.length > 0 && !(teamIdsParam.length === 1 && teamIdsParam[0] === TEAM_ID_NONE)
            ? teamIdsParam.filter((id) => id !== TEAM_ID_NONE)
            : undefined,
        no_teams: teamIdsParam?.length === 1 && teamIdsParam[0] === TEAM_ID_NONE,
      }),
  });

  const { data: coverage } = useQuery({
    queryKey: ['sync', 'coverage'],
    queryFn: getSyncCoverage,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: getSyncStatus,
  });

  const fullSyncMutation = useMutation({
    mutationFn: triggerLinearFullSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'coverage'] });
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['linear'] });
    },
  });

  const linearConnector = coverage?.connectors?.find(
    (c: { connector_name: string }) => c.connector_name === 'linear'
  );
  const syncLabel = linearConnector?.display_name || 'Linear';
  const lastSync = linearConnector?.last_sync_at;

  if (isLoading) return <div className="loading">Loading Linear overview…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const issuesCompleted = data?.issues_completed ?? 0;
  const issuesPerWeek = data?.issues_completed_per_week ?? 0;
  const backlog = data?.backlog_count ?? 0;
  const timeInStateMedianHours = data?.time_in_state_median_hours;
  const timeInStateCount = data?.time_in_state_count ?? 0;
  const timeInStateMedianDays = timeInStateMedianHours != null ? timeInStateMedianHours / 24 : null;
  const timeInStateValue = timeInStateMedianDays != null ? `${timeInStateMedianDays.toFixed(1)}d` : '—';

  return (
    <div className="linear-overview">
      <div className="linear-overview__header">
        <div>
          <h1 className="screen-title">Linear</h1>
          <p className="linear-overview__subtitle">Issues, backlog, and time in state</p>
        </div>
      </div>

      <div className="linear-overview__sync">
        <span className="linear-overview__sync-label">
          <span className="linear-overview__sync-icon" aria-hidden>↻</span>
          {syncLabel} Last sync: {formatTimeAgo(lastSync)}
        </span>
        <div className="linear-overview__sync-actions">
          <button
            type="button"
            className="linear-overview__import"
            onClick={() => fullSyncMutation.mutate()}
            disabled={fullSyncMutation.isPending}
          >
            {fullSyncMutation.isPending ? 'Syncing…' : 'Full sync'}
          </button>
        </div>
      </div>

      <div className="linear-overview__cards">
        <KpiCard
          title="Issues completed"
          value={String(issuesCompleted)}
          subtitle={`${formatDateRangeDisplay(startDate, endDate)} · ${issuesPerWeek.toFixed(1)}/week`}
          to="/metrics/linear/issues-completed"
          accent="green"
          icon={<span aria-hidden>✓</span>}
        />
        <KpiCard
          title="Backlog"
          value={String(backlog)}
          subtitle="open issues"
          to="/metrics/linear/backlog"
          accent="orange"
          icon={<span aria-hidden>▢</span>}
        />
        <KpiCard
          title="Time in state"
          value={timeInStateValue}
          subtitle={
            timeInStateCount > 0 && timeInStateMedianDays != null
              ? `${timeInStateCount} issues · median ${timeInStateMedianDays.toFixed(1)}d`
              : timeInStateCount > 0
                ? `${timeInStateCount} issues`
                : '—'
          }
          to="/metrics/linear/time-in-state"
          accent="purple"
          icon={<span aria-hidden>◷</span>}
        />
      </div>

      {syncStatus?.linear_teams && syncStatus.linear_teams.length > 0 && (
        <div className="linear-overview__linking">
          <h2 className="linear-overview__linking-title">PR linking per team</h2>
          <p className="linear-overview__linking-desc">
            Issues matched to a PR by identifier (e.g. [PIC-123]) in PR title or body. Used for cycle time calculation.
          </p>
          <ul className="linear-overview__linking-list">
            {syncStatus.linear_teams.map((t: { name: string; key: string; total_issues: number; linked_issues: number }) => {
              const pct = t.total_issues > 0 ? Math.round((t.linked_issues / t.total_issues) * 100) : 0;
              const pctDisplay = t.total_issues > 0 && t.linked_issues > 0 && pct === 0 ? '<1%' : `${pct}%`;
              return (
                <li key={t.key} className="linear-overview__linking-row">
                  <span className="linear-overview__linking-name">{t.name}</span>
                  <span className="linear-overview__linking-bar-bg">
                    <span
                      className="linear-overview__linking-bar-fill"
                      style={{ width: `${Math.max(pct, t.linked_issues > 0 ? 1 : 0)}%` }}
                    />
                  </span>
                  <span className="linear-overview__linking-stats">
                    {t.linked_issues.toLocaleString()} / {t.total_issues.toLocaleString()}
                  </span>
                  <span className="linear-overview__linking-pct">{pctDisplay}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
