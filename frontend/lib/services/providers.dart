import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_service.dart';
import 'dashboard_preferences_provider.dart';
import 'metrics_service.dart';
import '../models/anomaly.dart';
import '../models/developer.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';
import '../models/pr_detail.dart';
import '../models/pr_health.dart';
import '../models/alert.dart';
import '../models/correlation.dart';
import '../models/recommendation.dart';
import '../models/linear_metrics.dart';
import '../models/reviewer_workload.dart';
import '../models/sync_coverage.dart';
import '../widgets/period_selector.dart';
import '../widgets/repo_selector.dart';

/// Navigation tab enumeration for top-level navigation.
enum MainTab { dashboard, team, github, linear, alerts }

/// State provider for the current main navigation tab.
final mainTabProvider = StateProvider<MainTab>((ref) {
  return MainTab.dashboard;
});

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService();
});

/// Provider for PR detail (Individual PR Explorer) by PR id.
final prDetailProvider =
    FutureProvider.family<PRDetail, int>((ref, prId) async {
  final api = ref.read(apiServiceProvider);
  return api.getPRDetail(prId, includeHealth: true);
});

final metricsServiceProvider = Provider<MetricsService>((ref) {
  return MetricsService();
});

/// State provider for selected time period.
final selectedPeriodProvider = StateProvider<TimePeriod>((ref) {
  return TimePeriod.days30;
});

/// State provider for selected repository (legacy - single selection).
final selectedRepoProvider = StateProvider<RepoOption>((ref) {
  return RepoOption.all;
});

/// State provider for selected repository IDs (multi-selection).
/// Empty set means "all repositories".
final selectedRepoIdsProvider = StateProvider<Set<int>>((ref) {
  return {};
});

/// State provider for selected developer logins (multi-selection).
/// Empty set means "all developers".
final selectedDeveloperLoginsProvider = StateProvider<Set<String>>((ref) {
  return {};
});

/// State provider for selected Linear team IDs (multi-selection).
/// Empty set means "all teams".
final selectedTeamIdsProvider = StateProvider<Set<int>>((ref) {
  return {};
});

/// State provider for last refresh time.
final lastRefreshTimeProvider = StateProvider<DateTime?>((ref) {
  return null;
});

/// Provider for fetching DORA metrics with filters.
final doraMetricsProvider = FutureProvider<DORAMetrics>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getDORAMetrics(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching development metrics with filters.
final developmentMetricsProvider =
    FutureProvider<DevelopmentMetrics>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getDevelopmentMetrics(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching repositories.
final repositoriesProvider = FutureProvider<List<RepoOption>>((ref) async {
  final service = ref.read(apiServiceProvider);
  final repos = await service.getRepositories();
  return repos
      .map(
          (r) => RepoOption(id: r['id'] as int, name: r['full_name'] as String))
      .toList();
});

/// Provider for fetching developers with filters.
final developersProvider = FutureProvider<DevelopersResponse>((ref) async {
  final service = ref.read(apiServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  final data = await service.getDevelopers(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
  return DevelopersResponse.fromJson(data);
});

/// Provider for fetching a specific developer's stats.
final developerStatsProvider =
    FutureProvider.family<DeveloperStats, String>((ref, login) async {
  final service = ref.read(apiServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  final data = await service.getDeveloperStats(
    login,
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
  return DeveloperStats.fromJson(data);
});

/// Provider for fetching sync coverage data.
final syncCoverageProvider = FutureProvider<SyncCoverage>((ref) async {
  final service = ref.read(apiServiceProvider);
  final data = await service.getSyncCoverage();
  return SyncCoverage.fromJson(data);
});

// ============================================================================
// Individual Metric Providers
// ============================================================================

/// Provider for fetching deployment frequency metric.
final deploymentFrequencyProvider =
    FutureProvider<DeploymentFrequency>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getDeploymentFrequency(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    includeTrend: true,
    includeBenchmark: true,
  );
});

/// Provider for fetching deployment reliability (failure rate, MTTR, stability).
final deploymentReliabilityProvider =
    FutureProvider<DeploymentReliability>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getDeploymentReliability(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching lead time metric.
final leadTimeProvider = FutureProvider<LeadTimeForChanges>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getLeadTime(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    includeTrend: true,
    includeBenchmark: true,
  );
});

/// Provider for fetching PR review time metric.
final prReviewTimeProvider = FutureProvider<PRReviewTime>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getPRReviewTime(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    includeTrend: true,
    includeBenchmark: true,
  );
});

/// Provider for fetching PR merge time metric.
final prMergeTimeProvider = FutureProvider<PRMergeTime>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getPRMergeTime(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    includeTrend: true,
    includeBenchmark: true,
  );
});

/// Provider for fetching cycle time metric.
final cycleTimeProvider = FutureProvider<CycleTime>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getCycleTime(
    startDate: period.startDate,
    endDate: period.endDate,
    includeBenchmark: true,
  );
});

/// Provider for fetching throughput metric.
final throughputProvider = FutureProvider<Throughput>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  // If empty or multiple repos selected, fetch aggregated data (repoId = null)
  // If exactly one repo selected, fetch data for that repo
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getThroughput(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    includeTrend: true,
    includeBenchmark: true,
  );
});

// ============================================================================
// Per-Repository Metric Providers (for multi-repo view)
// ============================================================================

/// Provider for fetching deployment frequency for a specific repo.
final deploymentFrequencyByRepoProvider =
    FutureProvider.family<DeploymentFrequency, int?>((ref, repoId) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getDeploymentFrequency(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching lead time for a specific repo.
final leadTimeByRepoProvider =
    FutureProvider.family<LeadTimeForChanges, int?>((ref, repoId) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getLeadTime(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching PR review time for a specific repo.
final prReviewTimeByRepoProvider =
    FutureProvider.family<PRReviewTime, int?>((ref, repoId) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getPRReviewTime(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching PR merge time for a specific repo.
final prMergeTimeByRepoProvider =
    FutureProvider.family<PRMergeTime, int?>((ref, repoId) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getPRMergeTime(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching throughput for a specific repo.
final throughputByRepoProvider =
    FutureProvider.family<Throughput, int?>((ref, repoId) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getThroughput(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

// ============================================================================
// Per-Developer Metric Providers (for team/developer view)
// ============================================================================

/// Provider for fetching lead time for a specific developer.
final leadTimeByDeveloperProvider =
    FutureProvider.family<LeadTimeForChanges, String?>(
        (ref, authorLogin) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getLeadTime(
    startDate: period.startDate,
    endDate: period.endDate,
    authorLogin: authorLogin,
  );
});

/// Provider for fetching PR review time for a specific developer.
final prReviewTimeByDeveloperProvider =
    FutureProvider.family<PRReviewTime, String?>((ref, authorLogin) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getPRReviewTime(
    startDate: period.startDate,
    endDate: period.endDate,
    authorLogin: authorLogin,
  );
});

/// Provider for fetching PR merge time for a specific developer.
final prMergeTimeByDeveloperProvider =
    FutureProvider.family<PRMergeTime, String?>((ref, authorLogin) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getPRMergeTime(
    startDate: period.startDate,
    endDate: period.endDate,
    authorLogin: authorLogin,
  );
});

/// Provider for fetching throughput for a specific developer.
final throughputByDeveloperProvider =
    FutureProvider.family<Throughput, String?>((ref, authorLogin) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getThroughput(
    startDate: period.startDate,
    endDate: period.endDate,
    authorLogin: authorLogin,
  );
});

/// Provider for fetching deployment frequency for a specific developer.
final deploymentFrequencyByDeveloperProvider =
    FutureProvider.family<DeploymentFrequency, String?>(
        (ref, authorLogin) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);

  return service.getDeploymentFrequency(
    startDate: period.startDate,
    endDate: period.endDate,
    authorLogin: authorLogin,
  );
});

// ============================================================================
// Anomaly Detection Providers
// ============================================================================

/// Provider for deployment frequency anomalies.
final deploymentFrequencyAnomaliesProvider =
    FutureProvider<AnomalyResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repoIds = ref.watch(selectedRepoIdsProvider);
  final devLogins = ref.watch(selectedDeveloperLoginsProvider);

  // Use first selected repo, or null for all repos
  final repoId = repoIds.isEmpty ? null : repoIds.first;
  final authorLogin = devLogins.isEmpty ? null : devLogins.first;

  return service.getAnomalies(
    metric: 'deployment_frequency',
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    authorLogin: authorLogin,
  );
});

/// Provider for throughput anomalies.
final throughputAnomaliesProvider =
    FutureProvider<AnomalyResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repoIds = ref.watch(selectedRepoIdsProvider);
  final devLogins = ref.watch(selectedDeveloperLoginsProvider);

  final repoId = repoIds.isEmpty ? null : repoIds.first;
  final authorLogin = devLogins.isEmpty ? null : devLogins.first;

  return service.getAnomalies(
    metric: 'throughput',
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    authorLogin: authorLogin,
  );
});

/// Provider for lead time anomalies.
final leadTimeAnomaliesProvider = FutureProvider<AnomalyResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repoIds = ref.watch(selectedRepoIdsProvider);
  final devLogins = ref.watch(selectedDeveloperLoginsProvider);

  final repoId = repoIds.isEmpty ? null : repoIds.first;
  final authorLogin = devLogins.isEmpty ? null : devLogins.first;

  return service.getAnomalies(
    metric: 'lead_time',
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    authorLogin: authorLogin,
  );
});

/// Provider for fetching PR health scores.
final prHealthProvider = FutureProvider<PRHealthResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repoIds = ref.watch(selectedRepoIdsProvider);
  final devLogins = ref.watch(selectedDeveloperLoginsProvider);

  final repoId = repoIds.isEmpty ? null : repoIds.first;
  final authorLogin = devLogins.isEmpty ? null : devLogins.first;

  return service.getPRHealth(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
    authorLogin: authorLogin,
    includeSummary: true,
  );
});

/// Provider for fetching reviewer workload.
final reviewerWorkloadProvider =
    FutureProvider<ReviewerWorkloadResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getReviewerWorkload(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for fetching prioritized recommendations.
final recommendationsProvider =
    FutureProvider<RecommendationsResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);

  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;

  return service.getRecommendations(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

/// Provider for metric correlations (deployment frequency, throughput, lead time).
final correlationsProvider = FutureProvider<CorrelationsResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;
  return service.getCorrelations(
    startDate: period.startDate,
    endDate: period.endDate,
    period: 'week',
    repoId: repoId,
  );
});

/// Provider for active alerts (rule evaluations).
final alertsProvider = FutureProvider<AlertsResponse>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final selectedRepoIds = ref.watch(selectedRepoIdsProvider);
  final repoId = selectedRepoIds.length == 1 ? selectedRepoIds.first : null;
  return service.getAlerts(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repoId,
  );
});

// ============================================================================
// Linear providers
// ============================================================================

/// Provider for Linear teams list.
final linearTeamsProvider = FutureProvider<List<LinearTeam>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final data = await api.getLinearTeams(limit: 100);
  final items = data['items'] as List<dynamic>? ?? [];
  return items
      .map((e) => LinearTeam.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Provider for Linear issues list (first page, optional filters via family).
final linearIssuesProvider =
    FutureProvider.family<List<LinearIssue>, LinearIssuesFilter>(
        (ref, filter) async {
  final api = ref.read(apiServiceProvider);
  final data = await api.getLinearIssues(
    teamIds: filter.teamIds,
    state: filter.state,
    linked: filter.linked,
    page: 1,
    limit: 50,
  );
  final items = data['items'] as List<dynamic>? ?? [];
  return items
      .map((e) => LinearIssue.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Filter params for Linear issues list (used as family key).
class LinearIssuesFilter {
  final List<int>? teamIds;
  final String? state;
  final bool? linked;

  const LinearIssuesFilter({this.teamIds, this.state, this.linked});

  static const none = LinearIssuesFilter();

  /// Filter from current selected teams (non-empty = filter to those teams).
  static LinearIssuesFilter fromSelected(Set<int> ids) =>
      LinearIssuesFilter(teamIds: ids.isEmpty ? null : ids.toList());

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LinearIssuesFilter &&
          _listEquals(teamIds, other.teamIds) &&
          state == other.state &&
          linked == other.linked;

  static bool _listEquals(List<int>? a, List<int>? b) {
    if (a == b) return true;
    if (a == null || b == null || a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hash(
        teamIds == null ? null : Object.hashAll(teamIds!),
        state,
        linked,
      );
}

/// Current Linear issues filter from selected teams (for family key).
final linearIssuesFilterProvider = Provider<LinearIssuesFilter>((ref) {
  final ids = ref.watch(selectedTeamIdsProvider);
  return LinearIssuesFilter.fromSelected(ids);
});

/// Resolved team IDs for Linear API: list when non-empty (one or more teams), else null (all teams).
List<int>? _resolvedTeamIds(Set<int> ids) => ids.isEmpty ? null : ids.toList();

/// Provider for Linear overview (dashboard block and Linear overview screen).
final linearOverviewProvider = FutureProvider<LinearOverview>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final teamIds = ref.watch(selectedTeamIdsProvider);
  return service.getLinearOverview(
    startDate: period.startDate,
    endDate: period.endDate,
    teamIds: _resolvedTeamIds(teamIds),
  );
});

/// Provider for Linear issues completed (time series).
final linearIssuesCompletedProvider =
    FutureProvider<LinearIssuesCompleted>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final teamIds = ref.watch(selectedTeamIdsProvider);
  return service.getLinearIssuesCompleted(
    startDate: period.startDate,
    endDate: period.endDate,
    period: 'week',
    teamIds: _resolvedTeamIds(teamIds),
  );
});

/// Provider for Linear backlog count.
final linearBacklogProvider = FutureProvider<LinearBacklog>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final teamIds = ref.watch(selectedTeamIdsProvider);
  return service.getLinearBacklog(teamIds: _resolvedTeamIds(teamIds));
});

/// Provider for Linear time-in-state metric.
final linearTimeInStateProvider =
    FutureProvider<LinearTimeInState>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final teamIds = ref.watch(selectedTeamIdsProvider);
  return service.getLinearTimeInState(
    startDate: period.startDate,
    endDate: period.endDate,
    teamIds: _resolvedTeamIds(teamIds),
  );
});
