import { useAuthStore } from '@/stores/auth.js';

const baseUrl =
  (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env
    .VITE_API_BASE_URL ?? 'http://localhost:8000';

type QueryParams = Record<string, string | number | boolean | undefined | (string | number)[] | number[]>;

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function handleUnauthorized(): void {
  useAuthStore.getState().logout();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
    window.location.href = '/login';
  }
}

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
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type ApiPostOptions = {
  /** Request timeout in milliseconds (e.g. 300000 for 5 minutes). */
  timeoutMs?: number;
};

export async function apiPost<T>(
  path: string,
  data?: Record<string, unknown>,
  options?: ApiPostOptions
): Promise<T> {
  const controller = new AbortController();
  const timeoutId =
    options?.timeoutMs != null
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;
  try {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
}

export async function apiPut<T>(path: string, data?: Record<string, unknown>): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, data?: Record<string, unknown>): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export { baseUrl };
