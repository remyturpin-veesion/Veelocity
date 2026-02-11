import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getCursorOverview, getSettings } from '@/api/endpoints.js';
import { KpiCard } from '@/components/KpiCard.js';
import { EmptyState } from '@/components/EmptyState.js';
import { PageSummary } from '@/components/PageSummary.js';
import { useFiltersStore, formatDateRangeDisplay } from '@/stores/filters.js';

export function CursorOverviewScreen() {
  useFiltersStore((s) => s.dateRange);
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const { startDate, endDate } = getStartEnd();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['cursor', 'overview', startDate, endDate],
    queryFn: () => getCursorOverview({ start_date: startDate, end_date: endDate }),
    enabled: settings?.cursor_configured === true,
  });

  if (settings?.cursor_configured !== true) {
    return (
      <div>
        <h1 className="screen-title">Cursor</h1>
        <PageSummary>Team usage, spend, and activity · Filtered by date range</PageSummary>
        <EmptyState
          title="Cursor not connected"
          message="Add your Cursor API key in Settings to see team size, spend, and usage here. Create a key in Cursor Dashboard → Settings → Advanced → Admin API Keys."
          actionLabel="Open Settings"
          onAction={() => {
            const gear = document.querySelector('[aria-label="Settings"]') as HTMLButtonElement;
            gear?.click();
          }}
        />
      </div>
    );
  }

  if (isLoading) return <div className="loading">Loading Cursor overview…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const teamCount = data?.team_members_count ?? 0;
  const spendCents = data?.spend_cents ?? 0;
  const spendDollars = (spendCents / 100).toFixed(2);
  const usageByDay = data?.usage_by_day ?? [];
  const usageTotals = data?.usage_totals;
  const dauData = data?.dau ?? [];

  // Build spend subtitle: member count + last synced time
  const spendSubtitleParts: string[] = [];
  if (data?.spend_members != null) spendSubtitleParts.push(`${data.spend_members} members`);
  if (data?.spend_synced_at) {
    const syncedDate = new Date(data.spend_synced_at);
    spendSubtitleParts.push(`updated ${syncedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  }
  const spendSubtitle = spendSubtitleParts.length > 0 ? spendSubtitleParts.join(' · ') : undefined;

  const linesChartData = usageByDay.map((d) => ({
    date: d.date,
    lines_added: d.lines_added,
    lines_deleted: d.lines_deleted,
  }));

  // Composer, Chat, Agent and Tab completions are on the same scale — one chart with all four
  const requestsChartData = usageByDay.map((d) => ({
    date: d.date,
    composer: d.composer_requests,
    chat: d.chat_requests,
    agent: d.agent_requests,
    tabs_accepted: d.tabs_accepted,
  }));

  // Tab acceptance rate chart data
  const tabsChartData = usageByDay.map((d) => ({
    date: d.date,
    shown: d.tabs_shown,
    accepted: d.tabs_accepted,
  }));

  const totalRequests =
    usageTotals != null
      ? usageTotals.composer_requests +
        usageTotals.chat_requests +
        usageTotals.agent_requests +
        usageTotals.tabs_accepted
      : 0;

  // Tab acceptance rate percentage
  const tabAcceptRate =
    usageTotals != null && usageTotals.tabs_shown > 0
      ? ((usageTotals.tabs_accepted / usageTotals.tabs_shown) * 100).toFixed(1)
      : null;

  // AI suggestion acceptance: applies, accepts, rejects
  const totalInteractions =
    usageTotals != null
      ? usageTotals.applies + usageTotals.accepts + usageTotals.rejects
      : 0;
  const acceptanceRate =
    totalInteractions > 0 && usageTotals != null
      ? (((usageTotals.applies + usageTotals.accepts) / totalInteractions) * 100).toFixed(1)
      : null;

  // Average DAU
  const avgDau =
    dauData.length > 0
      ? Math.round(dauData.reduce((sum, d) => sum + (d.dau ?? 0), 0) / dauData.length)
      : null;

  return (
    <div>
      <h1 className="screen-title">Cursor</h1>
      <PageSummary>
        Team usage, spend, and activity · Filtered by date range · Aligned with Cursor Dashboard
      </PageSummary>

      {/* Top-level KPIs: team, spend, DAU */}
      <div className="dashboard__kpi-row" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', maxWidth: 860 }}>
        <KpiCard
          title="Team members"
          value={String(teamCount)}
          subtitle="in Cursor team"
          icon="👥"
        />
        <KpiCard
          title="Current cycle spend"
          value={data?.spend_cents != null ? `$${spendDollars}` : '—'}
          subtitle={spendSubtitle}
          icon="💰"
        />
        {avgDau != null && (
          <KpiCard
            title="Avg. daily active users"
            value={String(avgDau)}
            subtitle={formatDateRangeDisplay(startDate, endDate)}
            icon="📊"
          />
        )}
      </div>

      {/* Usage: KPIs + charts (lines, composer/chat, tabs) */}
      <section style={{ marginBottom: 32 }}>
        <h2 className="dashboard-section-title" style={{ marginBottom: 16 }}>Usage</h2>

        {usageTotals && (
          <div className="dashboard__kpi-row" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', maxWidth: 1120 }}>
            <KpiCard
              title="Lines added"
              value={usageTotals.lines_added.toLocaleString()}
              subtitle={formatDateRangeDisplay(startDate, endDate)}
              icon="📝"
            />
            <KpiCard
              title="Total AI requests"
              value={totalRequests.toLocaleString()}
              subtitle={`Composer + Chat + Agent + Tabs · ${formatDateRangeDisplay(startDate, endDate)}`}
              icon="✨"
            />
            {tabAcceptRate != null && (
              <KpiCard
                title="Tab accept rate"
                value={`${tabAcceptRate}%`}
                subtitle={`${usageTotals.tabs_accepted.toLocaleString()} / ${usageTotals.tabs_shown.toLocaleString()} shown`}
                icon="⇥"
                accent="green"
              />
            )}
            {acceptanceRate != null && (
              <KpiCard
                title="AI accept rate"
                value={`${acceptanceRate}%`}
                subtitle={`${(usageTotals.applies + usageTotals.accepts).toLocaleString()} accepted · ${usageTotals.rejects.toLocaleString()} rejected`}
                icon="✓"
                accent="green"
              />
            )}
          </div>
        )}

        {linesChartData.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Lines added & deleted</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={linesChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="lines_added" name="Lines added" stroke="var(--metric-green)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="lines_deleted" name="Lines deleted" stroke="var(--metric-orange)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {requestsChartData.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
              Composer, Chat, Agent & Tab completions accepted
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={requestsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="composer" name="Composer" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="chat" name="Chat" stroke="var(--metric-blue)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="agent" name="Agent" stroke="var(--text-muted)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="tabs_accepted" name="Tabs accepted" stroke="var(--metric-green)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {tabsChartData.length > 0 && tabsChartData.some((d) => d.shown > 0) && (
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Tab completions: shown vs accepted</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tabsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Legend />
                <Bar dataKey="shown" name="Shown" fill="var(--surface-border)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="accepted" name="Accepted" fill="var(--metric-green)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {dauData.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Daily active users</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dauData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="dau" name="Active users" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!usageTotals && data?.usage_summary && (data.usage_summary as unknown[]).length > 0 && (
          <div className="card">
            <h3 className="dashboard-section-title">Recent usage ({formatDateRangeDisplay(startDate, endDate)})</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Raw usage data is available but could not be aggregated. For full breakdown, use the{' '}
              <a href="https://cursor.com/dashboard?tab=usage" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>
                Cursor Dashboard → Usage
              </a>
              .
            </p>
          </div>
        )}
      </section>

      <p style={{ marginTop: 24, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Link to="/" style={{ color: 'var(--link)' }}>Dashboard</Link> includes a Cursor summary when connected.
      </p>
    </div>
  );
}
