import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_service.dart';
import 'metrics_service.dart';
import '../models/developer.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';
import '../models/sync_coverage.dart';
import '../widgets/period_selector.dart';
import '../widgets/repo_selector.dart';

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService();
});

final metricsServiceProvider = Provider<MetricsService>((ref) {
  return MetricsService();
});

/// State provider for selected time period.
final selectedPeriodProvider = StateProvider<TimePeriod>((ref) {
  return TimePeriod.days30;
});

/// State provider for selected repository.
final selectedRepoProvider = StateProvider<RepoOption>((ref) {
  return RepoOption.all;
});

/// Provider for fetching DORA metrics with filters.
final doraMetricsProvider = FutureProvider<DORAMetrics>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repo = ref.watch(selectedRepoProvider);

  return service.getDORAMetrics(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repo.id,
  );
});

/// Provider for fetching development metrics with filters.
final developmentMetricsProvider =
    FutureProvider<DevelopmentMetrics>((ref) async {
  final service = ref.read(metricsServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repo = ref.watch(selectedRepoProvider);

  return service.getDevelopmentMetrics(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repo.id,
  );
});

/// Provider for fetching repositories.
final repositoriesProvider = FutureProvider<List<RepoOption>>((ref) async {
  final service = ref.read(apiServiceProvider);
  final repos = await service.getRepositories();
  return repos.map((r) => RepoOption(id: r['id'] as int, name: r['full_name'] as String)).toList();
});

/// Provider for fetching developers with filters.
final developersProvider = FutureProvider<DevelopersResponse>((ref) async {
  final service = ref.read(apiServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repo = ref.watch(selectedRepoProvider);

  final data = await service.getDevelopers(
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repo.id,
  );
  return DevelopersResponse.fromJson(data);
});

/// Provider for fetching a specific developer's stats.
final developerStatsProvider =
    FutureProvider.family<DeveloperStats, String>((ref, login) async {
  final service = ref.read(apiServiceProvider);
  final period = ref.watch(selectedPeriodProvider);
  final repo = ref.watch(selectedRepoProvider);

  final data = await service.getDeveloperStats(
    login,
    startDate: period.startDate,
    endDate: period.endDate,
    repoId: repo.id,
  );
  return DeveloperStats.fromJson(data);
});

/// Provider for fetching sync coverage data.
final syncCoverageProvider = FutureProvider<SyncCoverage>((ref) async {
  final service = ref.read(apiServiceProvider);
  final data = await service.getSyncCoverage();
  return SyncCoverage.fromJson(data);
});
