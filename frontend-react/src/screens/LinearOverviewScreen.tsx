import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getLinearOverview, getSyncCoverage, triggerImportRange } from '@/api/endpoints.js';
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
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const teamIds = useFiltersStore((s) => s.teamIds);
  const linearSidebarSelection = useFiltersStore((s) => s.linearSidebarSelection);
  const { startDate, endDate } = getStartEnd();
  const teamIdsArray = teamIds.size ? Array.from(teamIds) : undefined;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['linear', 'overview', startDate, endDate, teamIdsArray],
    queryFn: () =>
      getLinearOverview({
        start_date: startDate,
        end_date: endDate,
        team_ids: teamIdsArray,
      }),
  });

  const { data: coverage } = useQuery({
    queryKey: ['sync', 'coverage'],
    queryFn: getSyncCoverage,
  });

  const importMutation = useMutation({
    mutationFn: () =>
      triggerImportRange({
        start_date: startDate,
        end_date: endDate,
        connector: 'linear',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'coverage'] });
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
        <button type="button" className="linear-overview__save" disabled>
          Save
        </button>
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
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            Import ▾
          </button>
        </div>
      </div>

      <div className="linear-overview__cards">
        {linearSidebarSelection.has('issues-completed') && (
          <KpiCard
            title="Issues completed"
            value={String(issuesCompleted)}
            subtitle={`Last 30 days · ${issuesPerWeek.toFixed(1)}/week`}
            to="/metrics/linear/issues-completed"
            accent="green"
            icon={<span aria-hidden>✓</span>}
          />
        )}
        {linearSidebarSelection.has('backlog') && (
          <KpiCard
            title="Backlog"
            value={String(backlog)}
            subtitle="open issues"
            to="/metrics/linear/backlog"
            accent="orange"
            icon={<span aria-hidden>▢</span>}
          />
        )}
        {linearSidebarSelection.has('time-in-state') && (
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
        )}
        {!linearSidebarSelection.has('issues-completed') &&
          !linearSidebarSelection.has('backlog') &&
          !linearSidebarSelection.has('time-in-state') && (
            <p className="linear-overview__empty-hint">
              Select metrics in the left sidebar to display cards.
            </p>
          )}
      </div>
    </div>
  );
}
