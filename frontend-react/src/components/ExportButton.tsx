import { useFiltersStore } from '@/stores/filters.js';
import { getExportReportUrl } from '@/api/endpoints.js';

export function ExportButton() {
  const getStartEnd = useFiltersStore((s) => s.getStartEnd);
  const repoId = useFiltersStore((s) => s.getRepoIdForApi)();
  const { startDate, endDate } = getStartEnd();

  const handleExport = (format: 'json' | 'csv') => {
    const url = getExportReportUrl({
      startDate,
      endDate,
      repoId: repoId ?? undefined,
      format,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="app-shell__export">
      <button
        type="button"
        className="app-shell__btn app-shell__btn--secondary"
        onClick={() => handleExport('json')}
        title="Export as JSON"
      >
        Export JSON
      </button>
      <button
        type="button"
        className="app-shell__btn app-shell__btn--secondary"
        onClick={() => handleExport('csv')}
        title="Export as CSV"
      >
        Export CSV
      </button>
    </div>
  );
}
