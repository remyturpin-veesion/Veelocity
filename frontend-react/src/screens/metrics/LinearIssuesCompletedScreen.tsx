import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useFiltersStore,
  formatDateRangeDisplay,
  TEAM_ID_NONE,
  getSprintNumber,
  getSprintDates,
  SPRINT_ANCHOR_DATE,
} from '@/stores/filters.js';
import { getLinearIssuesCompleted, type LinearCompletedIssue } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

function formatLeadTime(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

type SortKey = 'identifier' | 'team_name' | 'project_name' | 'lead_time_hours' | 'assignee_name' | 'completed_at';
type SortDir = 'asc' | 'desc';

const ACCENT_COLORS = {
  orange: 'var(--metric-orange)',
  green: 'var(--metric-green)',
  purple: 'var(--metric-purple)',
} as const;

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (active) {
    return <span style={{ marginLeft: 4, fontSize: 10 }}>{dir === 'asc' ? '▲' : '▼'}</span>;
  }
  return <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.25 }}>▲</span>;
}

function SprintComparisonCard({
  sprints,
  label,
}: {
  sprints: Array<{ title: string; value: string; subtitle: string; accent: 'orange' | 'green' | 'purple'; separator?: boolean }>;
  label: string;
}) {
  if (sprints.length === 0) return null;
  return (
    <div
      className="card"
      style={{ flex: 1, minWidth: sprints.length * 120, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        {sprints.map((s, i) => (
          <div
            key={s.title}
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: i > 0 ? 16 : 0,
              borderLeft: i > 0
                ? `${s.separator ? 2 : 1}px solid var(--border)`
                : 'none',
              marginLeft: i > 0 ? 16 : 0,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {s.title}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: ACCENT_COLORS[s.accent],
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FILTER_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '3px 7px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

function IssuesTable({ issues }: { issues: LinearCompletedIssue[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'completed_at', dir: 'desc' });
  const [filters, setFilters] = useState({ ticket: '', team: '', project: '', assignee: '', label: '' });

  if (issues.length === 0) return null;

  const handleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const filtered = issues.filter((issue) => {
    const labels = issue.labels ?? [];
    if (
      filters.ticket &&
      !`${issue.identifier} ${issue.title}`.toLowerCase().includes(filters.ticket.toLowerCase())
    )
      return false;
    if (filters.team && !issue.team_name.toLowerCase().includes(filters.team.toLowerCase())) return false;
    if (
      filters.project &&
      !(issue.project_name ?? '').toLowerCase().includes(filters.project.toLowerCase())
    )
      return false;
    if (
      filters.assignee &&
      !(issue.assignee_name ?? '').toLowerCase().includes(filters.assignee.toLowerCase())
    )
      return false;
    if (filters.label && !labels.some((l) => l.toLowerCase().includes(filters.label.toLowerCase())))
      return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va: string | number, vb: string | number;
    switch (sort.key) {
      case 'identifier':
        va = a.identifier;
        vb = b.identifier;
        break;
      case 'team_name':
        va = a.team_name;
        vb = b.team_name;
        break;
      case 'project_name':
        va = a.project_name ?? '';
        vb = b.project_name ?? '';
        break;
      case 'lead_time_hours':
        va = a.lead_time_hours ?? -1;
        vb = b.lead_time_hours ?? -1;
        break;
      case 'assignee_name':
        va = a.assignee_name ?? '';
        vb = b.assignee_name ?? '';
        break;
      case 'completed_at':
        va = a.completed_at ?? '';
        vb = b.completed_at ?? '';
        break;
      default:
        va = '';
        vb = '';
    }
    if (va < vb) return sort.dir === 'asc' ? -1 : 1;
    if (va > vb) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const leadTimes = sorted
    .filter((i) => i.lead_time_hours !== null)
    .map((i) => i.lead_time_hours as number);
  const avgLeadTime = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;
  const uniqueTeams = new Set(sorted.map((i) => i.team_name)).size;
  const uniqueProjects = new Set(sorted.filter((i) => i.project_name).map((i) => i.project_name)).size;
  const uniqueAssignees = new Set(sorted.filter((i) => i.assignee_name).map((i) => i.assignee_name)).size;

  const hasFilters = Object.values(filters).some((v) => v);
  const thSort: React.CSSProperties = {
    padding: '8px 12px',
    fontWeight: 500,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <div className="card" style={{ marginTop: 24, overflowX: 'auto' }}>
      <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        Completed issues ({sorted.length}
        {hasFilters ? ` / ${issues.length}` : ''})
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}
          >
            <th style={thSort} onClick={() => handleSort('identifier')}>
              Ticket <SortIcon active={sort.key === 'identifier'} dir={sort.dir} />
            </th>
            <th style={thSort} onClick={() => handleSort('team_name')}>
              Team <SortIcon active={sort.key === 'team_name'} dir={sort.dir} />
            </th>
            <th style={thSort} onClick={() => handleSort('project_name')}>
              Project <SortIcon active={sort.key === 'project_name'} dir={sort.dir} />
            </th>
            <th style={thSort} onClick={() => handleSort('lead_time_hours')}>
              Lead time <SortIcon active={sort.key === 'lead_time_hours'} dir={sort.dir} />
            </th>
            <th style={thSort} onClick={() => handleSort('assignee_name')}>
              Assignee <SortIcon active={sort.key === 'assignee_name'} dir={sort.dir} />
            </th>
            <th style={{ ...thSort, cursor: 'default' }}>Labels</th>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '4px 12px', fontWeight: 400 }}>
              <input
                type="text"
                placeholder="Filter…"
                value={filters.ticket}
                onChange={(e) => setFilters((f) => ({ ...f, ticket: e.target.value }))}
                style={FILTER_INPUT_STYLE}
              />
            </th>
            <th style={{ padding: '4px 12px', fontWeight: 400 }}>
              <input
                type="text"
                placeholder="Filter…"
                value={filters.team}
                onChange={(e) => setFilters((f) => ({ ...f, team: e.target.value }))}
                style={FILTER_INPUT_STYLE}
              />
            </th>
            <th style={{ padding: '4px 12px', fontWeight: 400 }}>
              <input
                type="text"
                placeholder="Filter…"
                value={filters.project}
                onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
                style={FILTER_INPUT_STYLE}
              />
            </th>
            <th style={{ padding: '4px 12px', fontWeight: 400 }} />
            <th style={{ padding: '4px 12px', fontWeight: 400 }}>
              <input
                type="text"
                placeholder="Filter…"
                value={filters.assignee}
                onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
                style={FILTER_INPUT_STYLE}
              />
            </th>
            <th style={{ padding: '4px 12px', fontWeight: 400 }}>
              <input
                type="text"
                placeholder="Filter…"
                value={filters.label}
                onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}
                style={FILTER_INPUT_STYLE}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((issue) => (
            <tr
              key={issue.id}
              style={{
                borderBottom:
                  '1px solid var(--border-subtle, color-mix(in srgb, var(--border) 50%, transparent))',
              }}
            >
              <td style={{ padding: '8px 12px', maxWidth: 340 }}>
                {issue.url ? (
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 12 }}>
                      {issue.identifier}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {issue.title}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, opacity: 0.5 }}
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{issue.identifier}</span>
                    <span>{issue.title}</span>
                  </span>
                )}
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {issue.team_name}
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {issue.project_name ?? '—'}
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {formatLeadTime(issue.lead_time_hours)}
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {issue.assignee_name ?? '—'}
              </td>
              <td style={{ padding: '8px 12px' }}>
                {(issue.labels ?? []).length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(issue.labels ?? []).map((label) => (
                      <span
                        key={label}
                        style={{
                          padding: '2px 7px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 500,
                          background:
                            'var(--bg-subtle, color-mix(in srgb, var(--accent) 15%, transparent))',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr
            style={{
              borderTop: '2px solid var(--border)',
              background:
                'var(--bg-subtle, color-mix(in srgb, var(--border) 20%, transparent))',
              color: 'var(--text-secondary)',
              fontSize: 12,
            }}
          >
            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {sorted.length} issue{sorted.length !== 1 ? 's' : ''}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {uniqueTeams} team{uniqueTeams !== 1 ? 's' : ''}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {uniqueProjects > 0
                ? `${uniqueProjects} project${uniqueProjects !== 1 ? 's' : ''}`
                : '—'}
            </td>
            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {avgLeadTime !== null ? `avg ${formatLeadTime(avgLeadTime)}` : '—'}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {uniqueAssignees > 0
                ? `${uniqueAssignees} assignee${uniqueAssignees !== 1 ? 's' : ''}`
                : '—'}
            </td>
            <td style={{ padding: '8px 12px' }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function buildTeamParams(teamIdsParam: number[] | undefined, noTeams: boolean) {
  return {
    team_ids:
      teamIdsParam && teamIdsParam.length > 0
        ? teamIdsParam.filter((id) => id !== TEAM_ID_NONE)
        : undefined,
    no_teams: noTeams,
  };
}

export function LinearIssuesCompletedScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const getChartPeriod = useFiltersStore((s) => s.getChartPeriod);
  useFiltersStore((s) => s.teamIds);
  const getTeamIdsForApi = useFiltersStore((s) => s.getTeamIdsForApi);
  const activeSprint = useFiltersStore((s) => s.activeSprint);

  const teamIdsParam = getTeamIdsForApi();
  const { startDate, endDate } = getStartEnd();
  const period = getChartPeriod();

  const noTeams = !!(teamIdsParam?.length === 1 && teamIdsParam[0] === TEAM_ID_NONE);
  const teamParams = buildTeamParams(
    teamIdsParam && !noTeams ? teamIdsParam : undefined,
    noTeams,
  );

  const viewSprint = activeSprint ?? getSprintNumber(new Date(endDate));
  const currentRealSprint = getSprintNumber(new Date());

  const sprintN = viewSprint;
  const sprintN1 = Math.max(1, viewSprint - 1);
  const sprintN2 = Math.max(1, viewSprint - 2);

  const { startDate: sN2, endDate: eN2 } = getSprintDates(sprintN2);
  const { startDate: sN1, endDate: eN1 } = getSprintDates(sprintN1);
  const { startDate: sN, endDate: eN } = getSprintDates(sprintN);

  const allTimeStart = SPRINT_ANCHOR_DATE;
  const allTimeEnd = new Date().toISOString().slice(0, 10);

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'linear', 'issues-completed', startDate, endDate, teamIdsParam, period],
    queryFn: () =>
      getLinearIssuesCompleted({ start_date: startDate, end_date: endDate, period, ...teamParams }),
  });

  const { data: dataN2 } = useQuery({
    queryKey: ['metrics', 'linear', 'issues-completed', sN2, eN2, teamIdsParam, 'day'],
    queryFn: () =>
      getLinearIssuesCompleted({ start_date: sN2, end_date: eN2, period: 'day', ...teamParams }),
    enabled: sprintN2 !== sprintN,
  });

  const { data: dataN1 } = useQuery({
    queryKey: ['metrics', 'linear', 'issues-completed', sN1, eN1, teamIdsParam, 'day'],
    queryFn: () =>
      getLinearIssuesCompleted({ start_date: sN1, end_date: eN1, period: 'day', ...teamParams }),
    enabled: sprintN1 !== sprintN,
  });

  const isMainQuerySprintN = activeSprint !== null && sN === startDate && eN === endDate;
  const { data: dataN } = useQuery({
    queryKey: ['metrics', 'linear', 'issues-completed', sN, eN, teamIdsParam, 'day'],
    queryFn: () =>
      getLinearIssuesCompleted({ start_date: sN, end_date: eN, period: 'day', ...teamParams }),
    enabled: !isMainQuerySprintN,
  });

  const { data: dataAllTime } = useQuery({
    queryKey: [
      'metrics',
      'linear',
      'issues-completed',
      allTimeStart,
      allTimeEnd,
      teamIdsParam,
      'day',
    ],
    queryFn: () =>
      getLinearIssuesCompleted({
        start_date: allTimeStart,
        end_date: allTimeEnd,
        period: 'day',
        ...teamParams,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="screen-title">Linear issues completed</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <h1 className="screen-title">Linear issues completed</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const chartData = (data?.data ?? []).map((p) => ({ label: p.period, value: p.count }));

  const totalN = isMainQuerySprintN ? (data?.total ?? null) : (dataN?.total ?? null);
  const totalN1 = sprintN1 === sprintN ? null : (dataN1?.total ?? null);
  const totalN2 = sprintN2 === sprintN ? null : (dataN2?.total ?? null);

  const allTimeTotal = dataAllTime?.total ?? null;
  const avgPerSprint =
    allTimeTotal !== null && currentRealSprint > 0
      ? Math.round(allTimeTotal / currentRealSprint)
      : null;

  const fmtSprintRange = (start: string, end: string) => {
    const fmt = (s: string) =>
      new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  // Average of the last 3 sprints (only from available data)
  const last3Totals = [totalN2, totalN1, totalN].filter((v): v is number => v !== null);
  const avg3Sprints =
    last3Totals.length > 0 ? Math.round(last3Totals.reduce((a, b) => a + b, 0) / last3Totals.length) : null;

  // Box 2: both averages side by side
  type SprintEntry = { title: string; value: string; subtitle: string; accent: 'orange' | 'green' | 'purple'; separator?: boolean };
  const avgComparison: SprintEntry[] = [
    {
      title: 'Avg / sprint',
      value: avgPerSprint !== null ? String(avgPerSprint) : '—',
      subtitle: `all ${currentRealSprint} sprints`,
      accent: 'purple',
    },
    {
      title: `Avg (last ${last3Totals.length})`,
      value: avg3Sprints !== null ? String(avg3Sprints) : '—',
      subtitle: `S${sprintN2}–S${sprintN}`,
      accent: 'purple',
      separator: true,
    },
  ];

  // Box 3: individual sprint columns only
  const sprintComparison: SprintEntry[] = [];
  if (sprintN2 !== sprintN) {
    sprintComparison.push({
      title: `Sprint ${sprintN2}`,
      value: totalN2 !== null ? String(totalN2) : '—',
      subtitle: fmtSprintRange(sN2, eN2),
      accent: 'orange',
    });
  }
  if (sprintN1 !== sprintN) {
    sprintComparison.push({
      title: `Sprint ${sprintN1}`,
      value: totalN1 !== null ? String(totalN1) : '—',
      subtitle: fmtSprintRange(sN1, eN1),
      accent: 'orange',
    });
  }
  sprintComparison.push({
    title: `Sprint ${sprintN}`,
    value: totalN !== null ? String(totalN) : '—',
    subtitle: fmtSprintRange(sN, eN),
    accent: 'green',
  });

  return (
    <div>
      <h1 className="screen-title">Linear issues completed</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {formatDateRangeDisplay(startDate, endDate)}
      </p>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <KpiCard title="Total completed" value={String(data?.total ?? '—')} />
        <SprintComparisonCard sprints={avgComparison} label="Averages" />
        <SprintComparisonCard sprints={sprintComparison} label="Sprint comparison" />
      </div>

      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 0 }}>
          <TrendChart data={chartData} title="Issues completed over time" height={240} />
        </div>
      )}
      {data?.issues && <IssuesTable issues={data.issues} />}
    </div>
  );
}
