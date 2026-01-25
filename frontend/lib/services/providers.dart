import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_service.dart';
import 'metrics_service.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService();
});

final metricsServiceProvider = Provider<MetricsService>((ref) {
  return MetricsService();
});

/// Provider for fetching DORA metrics.
/// Auto-refreshes when invalidated.
final doraMetricsProvider = FutureProvider<DORAMetrics>((ref) async {
  final service = ref.read(metricsServiceProvider);
  return service.getDORAMetrics();
});

/// Provider for fetching development metrics.
/// Auto-refreshes when invalidated.
final developmentMetricsProvider =
    FutureProvider<DevelopmentMetrics>((ref) async {
  final service = ref.read(metricsServiceProvider);
  return service.getDevelopmentMetrics();
});
