import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface GlobalFlowDataPoint {
  period: string;
  leadTimeHours?: number;
  cycleTimeHours?: number;
  deployments?: number;
}

interface GlobalFlowChartProps {
  data: GlobalFlowDataPoint[];
  title?: string;
  height?: number;
}

function formatPeriodLabel(period: string): string {
  try {
    const d = new Date(period);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return period;
  }
}

function formatHours(h: number): string {
  if (h >= 24) return `${(h / 24).toFixed(1)} days`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = Math.round(h * 60);
  return `${m}m`;
}

export function GlobalFlowChart({ data, title, height = 280 }: GlobalFlowChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    name: formatPeriodLabel(d.period),
  }));

  if (chartData.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="dashboard-section-title" style={{ marginTop: 0 }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            stroke="var(--text-muted)"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke="var(--text-muted)"
            tickFormatter={(v) => (v >= 24 ? `${(v / 24).toFixed(0)}d` : `${v}h`)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            stroke="var(--text-muted)"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
            }}
            labelStyle={{ color: 'var(--text)' }}
            formatter={(value: unknown, name?: string) => {
              const v = value as number | undefined;
              if (v == null) return '—';
              if (name === 'Lead Time' || name === 'Cycle Time') return formatHours(v);
              return v;
            }}
            labelFormatter={(label) => label}
          />
          <Legend />
          <Bar
            yAxisId="right"
            dataKey="deployments"
            name="Deployments"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="leadTimeHours"
            name="Lead Time"
            stroke="var(--metric-green)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="cycleTimeHours"
            name="Cycle Time"
            stroke="var(--metric-orange)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
