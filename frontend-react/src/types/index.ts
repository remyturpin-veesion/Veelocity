// API response types aligned with backend

export type TimePeriod = '7' | '30' | '90';

export interface PeriodData {
  period: string;
  count: number;
}

export interface TrendData {
  current_value: number;
  previous_value: number;
  change_percent: number;
  direction: string;
  is_improving: boolean;
  is_significant: boolean;
}

export interface BenchmarkThresholds {
  elite: number;
  high: number;
  medium: number;
}

export interface BenchmarkData {
  category: string;
  description: string;
  your_value: number;
  thresholds: BenchmarkThresholds;
  gap_to_elite: string;
  improvement_direction: string;
}

export interface DeploymentFrequency {
  period: string;
  start_date: string;
  end_date: string;
  data: PeriodData[];
  total: number;
  average: number;
  trend?: TrendData;
  benchmark?: BenchmarkData;
}

export interface LeadTimeMeasurement {
  deployment_id: number;
  first_commit_at: string;
  deployed_at: string;
  lead_time_hours: number;
}

export interface LeadTimeForChanges {
  start_date: string;
  end_date: string;
  count: number;
  average_hours: number;
  median_hours: number;
  measurements: LeadTimeMeasurement[];
  trend?: TrendData;
  benchmark?: BenchmarkData;
}

export interface DORAMetrics {
  deployment_frequency: DeploymentFrequency;
  lead_time_for_changes: LeadTimeForChanges;
}

export interface DeploymentReliability {
  start_date: string;
  end_date: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  cancelled_runs: number;
  failure_rate: number;
  mttr_hours?: number;
  stability_score: number;
  trend?: TrendData;
}

export interface Developer {
  login: string;
  avatar?: string;
  prs_created: number;
  prs_merged: number;
  reviews_given: number;
  comments_made: number;
}

export interface DeveloperStats {
  login: string;
  prs_created: number;
  prs_merged: number;
  prs_open: number;
  total_additions: number;
  total_deletions: number;
  avg_lines_per_pr: number;
  avg_merge_hours: number;
  reviews_given: number;
  comments_made: number;
  commits_made: number;
}

export interface DevelopersResponse {
  start_date: string;
  end_date: string;
  count: number;
  developers: Developer[];
}

export interface Repository {
  id: number;
  full_name: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SentryOverviewIssue {
  id: string;
  short_id: string;
  title: string;
  count: number;
  last_seen: string;
}

export interface SentryOverviewProject {
  id: string;
  slug: string;
  name: string;
  events_24h: number;
  events_7d: number;
  open_issues_count: number;
  top_issues: SentryOverviewIssue[];
}

export interface SentryOverviewResponse {
  sentry_base_url: string;
  org: string;
  org_totals: {
    events_24h: number;
    events_7d: number;
    open_issues_count: number;
  };
  projects: SentryOverviewProject[];
}

export interface SettingsResponse {
  github_configured: boolean;
  github_has_token?: boolean;
  github_repos?: string;
  github_orgs?: string[];
  linear_configured: boolean;
  linear_workspace_name?: string;
  cursor_configured?: boolean;
  greptile_configured?: boolean;
  sentry_configured?: boolean;
  sentry_base_url?: string;
  sentry_org?: string;
  sentry_project?: string;
  storage_available?: boolean;
  [key: string]: unknown;
}

export interface GreptileStatusResponse {
  connected: boolean;
  valid?: boolean;
  message?: string;
  repos_count?: number;
}

export interface GreptileRepoInfo {
  repository: string;
  remote: string;
  branch: string;
  private?: boolean;
  status: string;
  files_processed?: number;
  num_files?: number;
  sha?: string;
}

export interface GreptileOverviewResponse {
  repos_count: number;
  repositories: GreptileRepoInfo[];
  repos_by_status: Record<string, number>;
  repos_by_remote?: Record<string, number>;
  total_files_processed?: number;
  total_num_files?: number;
  indexing_complete_pct?: number | null;
}

export interface GreptileRepoMetric {
  repo_name: string;
  index_status: 'indexed' | 'active' | 'not_indexed' | 'stale' | 'error';
  file_coverage_pct: number | null;
  review_coverage_pct: number | null;
  avg_response_time_minutes: number | null;
  avg_comments_per_pr: number | null;
  total_prs: number;
  reviewed_prs: number;
}

export interface GreptileIndexHealth {
  indexed_repos: number;
  total_github_repos: number;
  error_repos: number;
  /** Repos checked via API and not present in Greptile (index via Greptile app to add). */
  not_found_repos?: number;
  stale_repos: number;
  total_files_processed: number;
  total_files: number;
  file_coverage_pct: number | null;
}

export interface GreptileTrendPoint {
  week: string;           // date string (YYYY-MM-DD) — day or week start
  coverage_pct: number;
  prs_total: number;
  prs_reviewed: number;
}

/** @deprecated Use GreptileTrendPoint */
export type GreptileTrendWeek = GreptileTrendPoint;

export interface GreptileRecommendation {
  type: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  message: string;
  detail: string;
  repos: string[];
  tags?: string[];
}

export interface GreptileMetricsResponse {
  review_coverage_pct: number;
  avg_response_time_minutes: number | null;
  avg_comments_per_pr: number | null;
  total_prs: number;
  prs_reviewed_by_greptile: number;
  prs_without_review: number;
  index_health: GreptileIndexHealth;
  per_repo: GreptileRepoMetric[];
  trend: GreptileTrendPoint[];
  recommendations: GreptileRecommendation[];
}

// ---------------------------------------------------------------------------
// Greptile management types
// ---------------------------------------------------------------------------

export interface GreptileManagedRepo {
  repository: string;
  github_repo_id: number | null;
  default_branch: string;
  greptile_status: string | null;  // completed, submitted, processing, cloning, failed, null
  index_status: string;  // derived: indexed, active, processing, not_indexed, error, stale
  greptile_branch: string | null;
  files_processed: number | null;
  num_files: number | null;
  sha: string | null;
  synced_at: string | null;
  is_indexed: boolean;
}

export interface GreptileReposResponse {
  repos: GreptileManagedRepo[];
  total_github_repos: number;
  total_greptile_repos: number;
  greptile_configured: boolean;
}

export interface GreptileRefreshResult {
  total: number;
  updated: number;
  results: Array<{
    repository: string;
    status: string | null;
    files_processed: number | null;
    num_files: number | null;
    refreshed: boolean;
  }>;
}

/** Result of fetching one repo's current status/error from Greptile API. */
export interface GreptileRepoDetailsResponse {
  repository: string;
  branch: string;
  found: boolean;
  status: string | null;
  error_code?: number | string;
  error_message: string | null;
  message?: string | null;
  files_processed?: number | null;
  num_files?: number | null;
}

export interface CursorStatusResponse {
  connected: boolean;
  valid?: boolean;
  message?: string;
  team_members_count?: number;
}

/** Per-day aggregated usage from Cursor Admin API (daily-usage-data). */
export interface CursorUsageDay {
  date: string;
  lines_added: number;
  lines_deleted: number;
  accepted_lines_added: number;
  accepted_lines_deleted: number;
  composer_requests: number;
  chat_requests: number;
  agent_requests: number;
  tabs_shown: number;
  tabs_accepted: number;
  applies: number;
  accepts: number;
  rejects: number;
  cmdk_usages: number;
  bugbot_usages: number;
}

/** Totals over the usage period (e.g. last 7 days). */
export interface CursorUsageTotals {
  lines_added: number;
  lines_deleted: number;
  accepted_lines_added: number;
  accepted_lines_deleted: number;
  composer_requests: number;
  chat_requests: number;
  agent_requests: number;
  tabs_shown: number;
  tabs_accepted: number;
  applies: number;
  accepts: number;
  rejects: number;
  cmdk_usages: number;
  bugbot_usages: number;
}

export interface CursorOverviewResponse {
  team_members_count: number;
  dau: Array<{ date: string; dau: number; cli_dau?: number; cloud_agent_dau?: number; bugbot_dau?: number }> | null;
  dau_period: { start: string; end: string } | null;
  spend_cents: number | null;
  spend_members: number | null;
  spend_synced_at: string | null;
  usage_summary: unknown[] | null;
  usage_by_day: CursorUsageDay[] | null;
  usage_totals: CursorUsageTotals | null;
}

export interface GitHubRepoSearchItem {
  id: number;
  full_name: string;
  name: string;
}

export interface GitHubReposSearchResponse {
  items: GitHubRepoSearchItem[];
}

export interface GitHubOrgItem {
  login: string;
  id: number;
}

export interface GitHubOrgsResponse {
  items: GitHubOrgItem[];
}

export interface SyncCoverageResponse {
  connectors: Array<{
    connector_name: string;
    display_name?: string;
    last_sync_at?: string;
    last_full_sync_at?: string;
  }>;
  repositories: Array<{
    id: number;
    name: string;
    [key: string]: unknown;
  }>;
  total_pull_requests: number;
  total_commits: number;
  total_workflow_runs: number;
  total_developers: number;
}

export interface SyncStatusResponse {
  total_prs: number;
  prs_with_details: number;
  prs_without_details: number;
  progress_percent: number;
  is_complete: boolean;
  repositories: Array<{
    name: string;
    total_prs: number;
    with_details: number;
    without_details: number;
  }>;
  linear_teams?: Array<{
    name: string;
    key: string;
    total_issues: number;
    linked_issues: number;
  }>;
  sync_in_progress: boolean;
  current_job: string | null;
  cursor_connected?: boolean;
  cursor_team_members_count?: number | null;
  greptile_connected?: boolean;
  greptile_repos_count?: number | null;
}

export interface DailyCountItem {
  date: string;
  count: number;
}

export interface DailyCoverageResponse {
  github: DailyCountItem[];
  linear: DailyCountItem[];
  cursor: DailyCountItem[];
  greptile: DailyCountItem[];
  sentry: DailyCountItem[];
}

export interface PRDetailRepository {
  id: number;
  full_name: string;
}

export interface PRDetailReview {
  reviewer_login: string;
  state: string;
  submitted_at?: string;
}

export interface PRDetailComment {
  author_login: string;
  body: string;
  created_at?: string;
}

export interface PRDetailCommit {
  sha: string;
  author_login: string;
  message: string;
  committed_at?: string;
}

export interface PRDetailHealth {
  health_score: number;
  health_category: string;
  component_scores: Record<string, number>;
  issues: string[];
}

export interface PRDetail {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  draft?: boolean;
  author_login: string;
  created_at?: string;
  merged_at?: string;
  additions: number;
  deletions: number;
  repository?: PRDetailRepository;
  reviews: PRDetailReview[];
  comments: PRDetailComment[];
  commits: PRDetailCommit[];
  health?: PRDetailHealth;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  metric?: string;
  metric_context?: string;
  priority?: string;
  link?: string | null;
  [key: string]: unknown;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  [key: string]: unknown;
}

export interface ProposedRecommendationsResponse {
  run_at: string | null;
  period_start: string | null;
  period_end: string | null;
  recommendations: Recommendation[];
}

export interface Correlation {
  metric_a: string;
  metric_b: string;
  correlation: number;
  [key: string]: unknown;
}

export interface CorrelationsResponse {
  start_date?: string;
  end_date?: string;
  period?: string;
  pairs?: Correlation[];
  correlations?: Correlation[]; // legacy
  [key: string]: unknown;
}

export interface LinearOverview {
  start_date?: string;
  end_date?: string;
  issues_completed?: number;
  issues_completed_per_week?: number;
  backlog_count?: number;
  time_in_state_average_hours?: number;
  time_in_state_median_hours?: number;
  time_in_state_count?: number;
  [key: string]: unknown;
}

export interface DevelopmentMetrics {
  pr_review_time?: { average_hours: number; [key: string]: unknown };
  pr_merge_time?: { average_hours: number; [key: string]: unknown };
  cycle_time?: { average_hours: number; [key: string]: unknown };
  throughput?: { total: number; [key: string]: unknown };
  [key: string]: unknown;
}
