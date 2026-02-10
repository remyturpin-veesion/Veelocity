import {
  apiGet,
  apiPost,
  apiPut,
} from './client.js';
import type {
  CorrelationsResponse,
  CursorOverviewResponse,
  CursorStatusResponse,
  DORAMetrics,
  DevelopersResponse,
  DeveloperStats,
  GitHubOrgsResponse,
  GitHubReposSearchResponse,
  GreptileIndexAllResult,
  GreptileIndexResult,
  GreptileMetricsResponse,
  GreptileOverviewResponse,
  GreptileRefreshResult,
  GreptileReposResponse,
  GreptileStatusResponse,
  LinearOverview,
  PaginatedResponse,
  PRDetail,
  ProposedRecommendationsResponse,
  RecommendationsResponse,
  Repository,
  SentryOverviewResponse,
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

export async function getGreptileMetrics(params?: {
  start_date?: string;
  end_date?: string;
  repo_ids?: number[] | null;
  granularity?: 'day' | 'week';
}): Promise<GreptileMetricsResponse> {
  const q: Record<string, string | number[]> = {};
  if (params?.start_date) q.start_date = params.start_date;
  if (params?.end_date) q.end_date = params.end_date;
  if (params?.repo_ids?.length) q.repo_ids = params.repo_ids;
  if (params?.granularity) q.granularity = params.granularity;
  return apiGet(prefix + '/greptile/metrics', Object.keys(q).length ? q : undefined);
}

export async function getGreptileRepos(): Promise<GreptileReposResponse> {
  return apiGet(prefix + '/greptile/repos');
}

const GREPTILE_INDEX_TIMEOUT_MS = 60_000;

export async function indexGreptileRepo(params: {
  repository: string;
  branch?: string;
  remote?: string;
  reload?: boolean;
}): Promise<GreptileIndexResult> {
  return apiPost(prefix + '/greptile/repos/index', params as Record<string, unknown>, {
    timeoutMs: GREPTILE_INDEX_TIMEOUT_MS,
  }) as Promise<GreptileIndexResult>;
}

const GREPTILE_INDEX_ALL_TIMEOUT_MS = 5 * 60_000;

export async function indexAllGreptileRepos(params?: {
  reload?: boolean;
  repos?: string[];
}): Promise<GreptileIndexAllResult> {
  return apiPost(prefix + '/greptile/repos/index-all', params as Record<string, unknown>, {
    timeoutMs: GREPTILE_INDEX_ALL_TIMEOUT_MS,
  }) as Promise<GreptileIndexAllResult>;
}

export async function refreshGreptileStatus(repos?: string[]): Promise<GreptileRefreshResult> {
  return apiPost(prefix + '/greptile/repos/refresh', repos ? { repos } : undefined, {
    timeoutMs: GREPTILE_INDEX_TIMEOUT_MS,
  }) as Promise<GreptileRefreshResult>;
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
  sentry_api_token?: string;
  sentry_base_url?: string;
  sentry_org?: string;
  sentry_project?: string;
}): Promise<SettingsResponse> {
  const body: Record<string, string | undefined> = {};
  if (updates.github_token != null) body.github_token = updates.github_token;
  if (updates.github_repos != null) body.github_repos = updates.github_repos;
  if (updates.linear_api_key != null) body.linear_api_key = updates.linear_api_key;
  if (updates.linear_workspace_name != null) body.linear_workspace_name = updates.linear_workspace_name;
  if (updates.cursor_api_key != null) body.cursor_api_key = updates.cursor_api_key;
  if (updates.greptile_api_key != null) body.greptile_api_key = updates.greptile_api_key;
  if (updates.sentry_api_token != null) body.sentry_api_token = updates.sentry_api_token;
  if (updates.sentry_base_url != null) body.sentry_base_url = updates.sentry_base_url;
  if (updates.sentry_org != null) body.sentry_org = updates.sentry_org;
  if (updates.sentry_project != null) body.sentry_project = updates.sentry_project;
  return apiPut(prefix + '/settings', body);
}

export async function testSentryConnection(): Promise<{ ok: boolean }> {
  return apiGet(prefix + '/settings/sentry/test');
}

export async function getSentryOverview(params?: {
  stats_period?: '24h' | '7d';
}): Promise<SentryOverviewResponse> {
  return apiGet(prefix + '/sentry/overview', params as Record<string, string>);
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

export async function getRepoPRs(
  repoId: number,
  params?: { page?: number; limit?: number }
): Promise<PaginatedResponse<{ id: number; number: number; title: string; state: string; author_login: string; created_at: string; merged_at: string | null }>> {
  const q: Record<string, number> = {};
  if (params?.page != null) q.page = params.page;
  if (params?.limit != null) q.limit = params.limit;
  return apiGet(
    `${prefix}/github/repos/${repoId}/prs`,
    Object.keys(q).length ? (q as Record<string, string | number>) : undefined
  ) as Promise<PaginatedResponse<{ id: number; number: number; title: string; state: string; author_login: string; created_at: string; merged_at: string | null }>>;
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

export async function getQuickOverview(params?: {
  start_date?: string;
  end_date?: string;
  repo_ids?: number[];
}): Promise<{ prs_in_queue: number; median_ci_duration_seconds: number | null }> {
  return apiGet(prefix + '/metrics/quick-overview', params as Record<string, string | number[]>);
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
  include_breakdown?: boolean;
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

export async function getProposedRecommendations(): Promise<ProposedRecommendationsResponse> {
  return apiGet(`${prefix}/metrics/recommendations/proposed`);
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

export async function getExportReport(params?: {
  start_date?: string;
  end_date?: string;
  repo_id?: number;
}): Promise<unknown> {
  return apiGet(`${prefix}/export/report`, params as Record<string, string | number>);
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
