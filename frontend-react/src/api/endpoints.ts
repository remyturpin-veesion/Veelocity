import {
  apiGet,
  apiPost,
  apiPut,
  getExportReportUrl as buildExportUrl,
} from './client.js';
import type {
  AlertsResponse,
  CorrelationsResponse,
  CursorOverviewResponse,
  CursorStatusResponse,
  DORAMetrics,
  DevelopersResponse,
  DeveloperStats,
  GitHubOrgsResponse,
  GitHubReposSearchResponse,
  GreptileOverviewResponse,
  GreptileStatusResponse,
  LinearOverview,
  PaginatedResponse,
  PRDetail,
  RecommendationsResponse,
  Repository,
  SettingsResponse,
  SyncCoverageResponse,
  SyncStatusResponse,
  DailyCoverageResponse,
} from '@/types/index.js';

const prefix = '/api/v1';

export async function healthCheck(): Promise<{ status: string }> {
  return apiGet(`${prefix}/health`);
}

export async function getRepositories(): Promise<{ items: Repository[] }> {
  const data = await apiGet<{ items: Repository[] }>(`${prefix}/repositories`);
  return data;
}

export async function triggerSync(): Promise<void> {
  await apiPost(`${prefix}/connectors/sync`);
}

const LINEAR_FULL_SYNC_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function triggerLinearFullSync(): Promise<{ status: string; message?: string; items_synced?: number }> {
  return apiPost(`${prefix}/sync/linear-full`, undefined, {
    timeoutMs: LINEAR_FULL_SYNC_TIMEOUT_MS,
  }) as Promise<{
    status: string;
    message?: string;
    items_synced?: number;
  }>;
}

export async function getGitHubOAuthStatus(): Promise<{ enabled: boolean }> {
  return apiGet(prefix + '/auth/github/status');
}

export async function getSettings(): Promise<SettingsResponse> {
  return apiGet(prefix + '/settings');
}

export async function getCursorStatus(): Promise<CursorStatusResponse> {
  return apiGet(prefix + '/cursor/status');
}

export async function getCursorOverview(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<CursorOverviewResponse> {
  return apiGet(prefix + '/cursor/overview', params as Record<string, string>);
}

export async function getGreptileStatus(): Promise<GreptileStatusResponse> {
  return apiGet(prefix + '/greptile/status');
}

export async function getGreptileOverview(params?: {
  repo_ids?: number[] | null;
}): Promise<GreptileOverviewResponse> {
  if (!params?.repo_ids?.length) {
    return apiGet(prefix + '/greptile/overview');
  }
  return apiGet(prefix + '/greptile/overview', {
    repo_ids: params.repo_ids,
  } as Record<string, number[]>);
}

export async function getGitHubOrgs(): Promise<GitHubOrgsResponse> {
  return apiGet(prefix + '/settings/github/orgs');
}

export async function getGitHubReposSearch(params?: {
  q?: string;
  per_page?: number;
  org?: string;
}): Promise<GitHubReposSearchResponse> {
  const query: Record<string, string | number> = {};
  if (params?.q != null) query.q = params.q;
  if (params?.per_page != null) query.per_page = params.per_page;
  if (params?.org != null) query.org = params.org;
  return apiGet(prefix + '/settings/github/repos', query);
}

export async function updateSettings(updates: {
  github_token?: string;
  github_repos?: string;
  linear_api_key?: string;
  linear_workspace_name?: string;
  cursor_api_key?: string;
  greptile_api_key?: string;
}): Promise<SettingsResponse> {
  const body: Record<string, string | undefined> = {};
  if (updates.github_token != null) body.github_token = updates.github_token;
  if (updates.github_repos != null) body.github_repos = updates.github_repos;
  if (updates.linear_api_key != null) body.linear_api_key = updates.linear_api_key;
  if (updates.linear_workspace_name != null) body.linear_workspace_name = updates.linear_workspace_name;
  if (updates.cursor_api_key != null) body.cursor_api_key = updates.cursor_api_key;
  if (updates.greptile_api_key != null) body.greptile_api_key = updates.greptile_api_key;
  return apiPut(prefix + '/settings', body);
}

export async function getDevelopers(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
}): Promise<DevelopersResponse> {
  return apiGet(`${prefix}/developers`, params as Record<string, string | number>);
}

export async function getDeveloperStats(
  login: string,
  params?: { start_date?: string; end_date?: string; repo_id?: number }
): Promise<DeveloperStats> {
  return apiGet(`${prefix}/developers/${encodeURIComponent(login)}`, params as Record<string, string | number>);
}

export async function getSyncCoverage(): Promise<SyncCoverageResponse> {
  return apiGet(`${prefix}/sync/coverage`);
}

export async function getDailyCoverage(days = 90): Promise<DailyCoverageResponse> {
  return apiGet(`${prefix}/sync/coverage/daily`, { days });
}

export async function getSyncStatus(): Promise<SyncStatusResponse> {
  return apiGet(`${prefix}/sync/status`);
}

export async function triggerImportRange(params: {
  start_date: string;
  end_date?: string;
  connector?: string;
}): Promise<unknown> {
  return apiPost(`${prefix}/sync/import-range`, params as Record<string, unknown>);
}

export async function getLinearTeams(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<unknown>> {
  return apiGet(`${prefix}/linear/teams`, params as Record<string, number>);
}

export async function getLinearIssues(params?: {
  team_ids?: number[];
  state?: string;
  linked?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<unknown>> {
  const q: Record<string, string | number | boolean | number[]> = {};
  if (params?.team_ids != null) q.team_ids = params.team_ids;
  if (params?.state != null) q.state = params.state;
  if (params?.linked != null) q.linked = params.linked;
  if (params?.page != null) q.page = params.page;
  if (params?.limit != null) q.limit = params.limit;
  return apiGet(`${prefix}/linear/issues`, Object.keys(q).length ? q : undefined);
}

export async function getPRDetail(prId: number, includeHealth = true): Promise<PRDetail> {
  const data = await apiGet<PRDetail | { error: string }>(
    `${prefix}/github/prs/${prId}`,
    { include_health: includeHealth } as Record<string, boolean>
  );
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error);
  }
  return data as PRDetail;
}

export function getExportReportUrl(params: {
  startDate: string;
  endDate: string;
  repoId?: number;
  format: 'json' | 'csv';
}): string {
  return buildExportUrl(params);
}

// Metrics
export async function getDORAMetrics(params?: {
  start_date?: string;
  end_date?: string;
  period?: string;
  repo_id?: number;
}): Promise<DORAMetrics> {
  return apiGet(`${prefix}/metrics/dora`, { ...params, period: params?.period ?? 'week' } as Record<string, string | number>);
}

export async function getDeploymentFrequency(params?: {
  start_date?: string;
  end_date?: string;
  period?: string;
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
  include_trend?: boolean;
  include_benchmark?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/dora/deployment-frequency`, {
    ...params,
    period: params?.period ?? 'week',
    include_trend: params?.include_trend ?? false,
    include_benchmark: params?.include_benchmark ?? false,
  } as Record<string, string | number | boolean | number[]>);
}

export async function getLeadTime(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
  include_trend?: boolean;
  include_benchmark?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/dora/lead-time`, params as Record<string, string | number | boolean | number[]>);
}

export async function getDeploymentReliability(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
  include_trend?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/dora/deployment-reliability`, {
    ...params,
    include_trend: params?.include_trend ?? false,
  } as Record<string, string | number | boolean | number[]>);
}

export async function getDevelopmentMetrics(params?: {
  start_date?: string;
  end_date?: string;
  period?: string;
  repo_id?: number;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/development`, {
    ...params,
    period: params?.period ?? 'week',
  } as Record<string, string | number>);
}

export async function getPRReviewTime(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
  include_trend?: boolean;
  include_benchmark?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/development/pr-review-time`, params as Record<string, string | number | boolean | number[]>);
}

export async function getPRMergeTime(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
  include_trend?: boolean;
  include_benchmark?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/development/pr-merge-time`, params as Record<string, string | number | boolean | number[]>);
}

export async function getCycleTime(params?: {
  start_date?: string;
  end_date?: string;
  team_id?: number;
  include_trend?: boolean;
  include_benchmark?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/development/cycle-time`, params as Record<string, string | number | boolean>);
}

export async function getLeadTimeByPeriod(params?: {
  start_date?: string;
  end_date?: string;
  period?: 'day' | 'week' | 'month';
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
}): Promise<{ period: string; median_hours: number }[]> {
  const data = await apiGet<{ period: string; median_hours: number }[]>(
    `${prefix}/metrics/dora/lead-time/by-period`,
    params as Record<string, string | number>
  );
  return Array.isArray(data) ? data : [];
}

export async function getCycleTimeByPeriod(params?: {
  start_date?: string;
  end_date?: string;
  period?: 'day' | 'week' | 'month';
  team_id?: number;
}): Promise<{ period: string; median_hours: number }[]> {
  const data = await apiGet<{ period: string; median_hours: number }[]>(
    `${prefix}/metrics/development/cycle-time/by-period`,
    params as Record<string, string | number>
  );
  return Array.isArray(data) ? data : [];
}

export async function getThroughput(params?: {
  start_date?: string;
  end_date?: string;
  period?: string;
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
  include_trend?: boolean;
  include_benchmark?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/development/throughput`, {
    ...params,
    period: params?.period ?? 'week',
    include_trend: params?.include_trend ?? false,
    include_benchmark: params?.include_benchmark ?? false,
  } as Record<string, string | number | boolean | number[]>);
}

export async function getPRHealth(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
  author_login?: string;
  min_score?: number;
  max_score?: number;
  include_summary?: boolean;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/pr-health`, {
    ...params,
    include_summary: params?.include_summary ?? true,
  } as Record<string, string | number | boolean | number[]>);
}

export async function getReviewerWorkload(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/reviewer-workload`, params as Record<string, string | number | number[]>);
}

export async function getRecommendations(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
}): Promise<RecommendationsResponse> {
  return apiGet(`${prefix}/metrics/recommendations`, params as Record<string, string | number | number[]>);
}

export async function getCorrelations(params?: {
  start_date?: string;
  end_date?: string;
  period?: string;
  repo_id?: number;
  repo_ids?: number[];
}): Promise<CorrelationsResponse> {
  return apiGet(`${prefix}/metrics/correlations`, {
    ...params,
    period: params?.period ?? 'week',
  } as Record<string, string | number | number[]>);
}

export async function getAlerts(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
  repo_ids?: number[];
}): Promise<AlertsResponse> {
  return apiGet(`${prefix}/alerts`, params as Record<string, string | number | number[]>);
}

export async function notifyAlerts(): Promise<unknown> {
  return apiPost(`${prefix}/alerts/notify`);
}

export async function getLinearOverview(params?: {
  start_date?: string;
  end_date?: string;
  team_ids?: number[];
  no_teams?: boolean;
  assignee_name?: string;
}): Promise<LinearOverview> {
  return apiGet(`${prefix}/metrics/linear/overview`, params as Record<string, string | number | boolean | number[]>);
}

export async function getLinearIssuesCompleted(params?: {
  start_date?: string;
  end_date?: string;
  period?: string;
  team_ids?: number[];
  no_teams?: boolean;
  assignee_name?: string;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/linear/issues-completed`, {
    ...params,
    period: params?.period ?? 'week',
  } as Record<string, string | number | boolean | number[]>);
}

export async function getLinearBacklog(params?: {
  team_ids?: number[];
  no_teams?: boolean;
  assignee_name?: string;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/linear/backlog`, params as Record<string, string | number | boolean | number[]>);
}

export async function getLinearTimeInState(params?: {
  start_date?: string;
  end_date?: string;
  team_ids?: number[];
  no_teams?: boolean;
  assignee_name?: string;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/linear/time-in-state`, params as Record<string, string | number | boolean | number[]>);
}

export async function getAnomalies(params: {
  metric: string;
  start_date?: string;
  end_date?: string;
  period?: string;
  repo_id?: number;
  author_login?: string;
}): Promise<unknown> {
  return apiGet(`${prefix}/metrics/anomalies`, {
    ...params,
    period: params.period ?? 'week',
  } as Record<string, string | number>);
}
