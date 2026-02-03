const baseUrl =
  (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env
    .VITE_API_BASE_URL ?? 'http://localhost:8000';

type QueryParams = Record<string, string | number | boolean | undefined | (string | number)[]>;

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, data?: Record<string, unknown>): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, data?: Record<string, unknown>): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getExportReportUrl(params: {
  startDate: string;
  endDate: string;
  repoId?: number;
  format: 'json' | 'csv';
}): string {
  const q: Record<string, string> = {
    start_date: params.startDate,
    end_date: params.endDate,
    format: params.format,
  };
  if (params.repoId != null) q.repo_id = String(params.repoId);
  return buildUrl('/api/v1/export/report', q as Record<string, string>);
}

export { baseUrl };
