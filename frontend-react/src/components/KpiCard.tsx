import { Link } from 'react-router-dom';

export type KpiAccent = 'green' | 'orange' | 'purple' | 'primary';

export interface KpiTrend {
  change_percent: number;
  is_improving: boolean;
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  to?: string;
  icon?: React.ReactNode;
  accent?: KpiAccent;
  trend?: KpiTrend;
}

const ACCENT_VAR: Record<KpiAccent, string> = {
  green: 'var(--metric-green)',
  orange: 'var(--metric-orange)',
  purple: 'var(--metric-purple)',
  primary: 'var(--primary)',
};

function formatTrendPercent(changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${changePercent}%`;
}

export function KpiCard({ title, value, subtitle, to, icon, accent = 'primary', trend }: KpiCardProps) {
  const accentColor = ACCENT_VAR[accent];
  const content = (
    <>
      {icon != null && (
        <span className="kpi-card__icon" style={{ color: accentColor }}>
          {icon}
        </span>
      )}
      <div className="card__title">{title}</div>
      <div className="kpi-card__value-row">
        <div className="card__value kpi-card__value" style={{ color: accentColor }}>
          {value}
        </div>
        {trend != null && (
          <span
            className="kpi-card__trend"
            style={{
              color: trend.is_improving ? 'var(--metric-green)' : 'var(--metric-orange)',
            }}
            aria-label={`Trend: ${formatTrendPercent(trend.change_percent)}`}
          >
            {formatTrendPercent(trend.change_percent)}
          </span>
        )}
      </div>
      {subtitle != null && <p className="kpi-card__subtitle">{subtitle}</p>}
    </>
  );
  const className = 'card kpi-card' + (to ? ' kpi-card--link' : '');
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
        <span className="kpi-card__arrow" aria-hidden>→</span>
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
