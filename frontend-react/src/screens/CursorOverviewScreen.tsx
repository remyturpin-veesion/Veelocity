import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
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
import { TrendChart } from '@/components/TrendChart.js';
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
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Team usage and spend from your Cursor workspace
        </p>
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

  const linesChartData = usageByDay.map((d) => ({
    date: d.date,
    lines_added: d.lines_added,
    lines_deleted: d.lines_deleted,
  }));

  const requestsChartData = usageByDay.map((d) => ({
    date: d.date,
    composer: d.composer_requests,
    chat: d.chat_requests,
    agent: d.agent_requests,
  }));

  const tabsChartData = usageByDay.map((d) => ({
    label: d.date,
    value: d.tabs_accepted,
  }));

  return (
    <div>
      <h1 className="screen-title">Cursor</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Usage and spend from your Cursor workspace (Admin API). Aligned with{' '}
        <a href="https://cursor.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>
          Cursor Dashboard
        </a>{' '}
        Usage tab.
      </p>

      {/* Top-level KPIs: team, spend (Team plan) */}
      <div className="dashboard__kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard
          title="Team members"
          value={String(teamCount)}
          subtitle="in Cursor team"
          icon="👥"
        />
        <KpiCard
          title="Current cycle spend"
          value={data?.spend_cents != null ? `$${spendDollars}` : '—'}
          subtitle={data?.spend_members != null ? `${data.spend_members} members` : undefined}
          icon="💰"
        />
      </div>

      {/* Usage: KPIs + charts (lines, composer/chat, tabs) */}
      <section style={{ marginBottom: 32 }}>
        <h2 className="dashboard-section-title" style={{ marginBottom: 16 }}>Usage</h2>

        {usageTotals && (
          <div className="dashboard__kpi-row" style={{ marginBottom: 24 }}>
            <KpiCard
              title="Lines added"
              value={usageTotals.lines_added.toLocaleString()}
              subtitle={formatDateRangeDisplay(startDate, endDate)}
              icon="📝"
            />
            <KpiCard
              title="Composer requests"
              value={usageTotals.composer_requests.toLocaleString()}
              subtitle={formatDateRangeDisplay(startDate, endDate)}
              icon="✨"
            />
            <KpiCard
              title="Chat requests"
              value={usageTotals.chat_requests.toLocaleString()}
              subtitle={formatDateRangeDisplay(startDate, endDate)}
              icon="💬"
            />
            <KpiCard
              title="Tabs accepted"
              value={usageTotals.tabs_accepted.toLocaleString()}
              subtitle={formatDateRangeDisplay(startDate, endDate)}
              icon="↩"
            />
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
            <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Composer, Chat & Agent requests</p>
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
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {tabsChartData.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <TrendChart
              data={tabsChartData}
              title="Tab completions accepted"
              color="var(--metric-blue)"
              height={200}
            />
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
