import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface TrendDataPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  color?: string;
  height?: number;
}

export function TrendChart({ data, title, color = 'var(--primary)', height = 200 }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data available
      </div>
    );
  }

  const chartData = data.map((d) => ({ name: d.label, value: d.value }));

  return (
    <div>
      {title && (
        <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 0 }}>{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
            labelStyle={{ color: 'var(--text)' }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
