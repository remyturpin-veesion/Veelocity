import { useQuery } from '@tanstack/react-query';
import { useFiltersStore } from '@/stores/filters.js';
import { getLeadTime } from '@/api/endpoints.js';
import { Breadcrumb } from '@/components/Breadcrumb.js';
import { KpiCard } from '@/components/KpiCard.js';
import { TrendChart } from '@/components/TrendChart.js';
import { SkeletonCard } from '@/components/SkeletonCard.js';

export function LeadTimeScreen() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', 'lead-time', startDate, endDate, repoId],
    queryFn: () =>
      getLeadTime({
        start_date: startDate,
        end_date: endDate,
        repo_id: repoId ?? undefined,
        include_trend: true,
        include_benchmark: true,
      }),
  });

  if (isLoading) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Lead time for changes</h1>
        <SkeletonCard />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Breadcrumb to="/" label="Dashboard" />
        </p>
        <h1 className="screen-title">Lead time for changes</h1>
        <div className="error">{(error as Error).message}</div>
      </div>
    );
  }

  const d = data as {
    start_date?: string;
    end_date?: string;
    count?: number;
    average_hours?: number;
    median_hours?: number;
    measurements?: Array<{ lead_time_hours: number }>;
  };

  const chartData = (d.measurements ?? [])
    .slice(-20)
    .map((m, i) => ({ label: `#${i + 1}`, value: m.lead_time_hours }));

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Breadcrumb to="/" label="Dashboard" />
      </p>
      <h1 className="screen-title">Lead time for changes</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        {d.start_date} – {d.end_date}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Changes" value={String(d.count ?? '—')} />
        <KpiCard title="Average (hours)" value={d.average_hours != null ? d.average_hours.toFixed(1) : '—'} />
        <KpiCard title="Median (hours)" value={d.median_hours != null ? d.median_hours.toFixed(1) : '—'} />
      </div>
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <TrendChart data={chartData} title="Lead time by change" height={240} />
        </div>
      )}
    </div>
  );
}
