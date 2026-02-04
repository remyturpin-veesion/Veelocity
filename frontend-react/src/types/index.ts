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

export interface SettingsResponse {
  github_configured: boolean;
  github_has_token?: boolean;
  github_repos?: string;
  linear_configured: boolean;
  linear_workspace_name?: string;
  storage_available?: boolean;
  [key: string]: unknown;
}

export interface GitHubRepoSearchItem {
  id: number;
  full_name: string;
  name: string;
}

export interface GitHubReposSearchResponse {
  items: GitHubRepoSearchItem[];
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

export interface DailyCoverageResponse {
  [key: string]: unknown;
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

export interface Alert {
  rule_id: string;
  title: string;
  message: string;
  severity: string;
  metric: string;
  current_value: unknown;
  threshold: string;
}

export interface AlertsResponse {
  start_date: string;
  end_date: string;
  alerts: Alert[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  metric?: string;
  priority?: string;
  [key: string]: unknown;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  [key: string]: unknown;
}

export interface Correlation {
  metric_a: string;
  metric_b: string;
  correlation: number;
  [key: string]: unknown;
}

export interface CorrelationsResponse {
  correlations: Correlation[];
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
