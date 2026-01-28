import 'package:dio/dio.dart';
import '../core/config.dart';
import '../models/anomaly.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';
import '../models/pr_health.dart';
import '../models/reviewer_workload.dart';

/// Service for fetching DORA and development metrics from the API.
class MetricsService {
  late final Dio _dio;

  MetricsService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );
  }

  /// Get all DORA metrics.
  Future<DORAMetrics> getDORAMetrics({
    DateTime? startDate,
    DateTime? endDate,
    String period = 'week',
    int? repoId,
  }) async {
    final queryParams = <String, dynamic>{
      'period': period,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }

    final response = await _dio.get(
      '/api/v1/metrics/dora',
      queryParameters: queryParams,
    );

    return DORAMetrics.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get deployment frequency metric only.
  Future<DeploymentFrequency> getDeploymentFrequency({
    DateTime? startDate,
    DateTime? endDate,
    String period = 'week',
    int? repoId,
    String? authorLogin,
    bool includeTrend = false,
    bool includeBenchmark = false,
  }) async {
    final queryParams = <String, dynamic>{
      'period': period,
      'include_trend': includeTrend,
      'include_benchmark': includeBenchmark,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }

    final response = await _dio.get(
      '/api/v1/metrics/dora/deployment-frequency',
      queryParameters: queryParams,
    );

    return DeploymentFrequency.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get lead time for changes metric only.
  Future<LeadTimeForChanges> getLeadTime({
    DateTime? startDate,
    DateTime? endDate,
    int? repoId,
    String? authorLogin,
    bool includeTrend = false,
    bool includeBenchmark = false,
  }) async {
    final queryParams = <String, dynamic>{
      'include_trend': includeTrend,
      'include_benchmark': includeBenchmark,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }

    final response = await _dio.get(
      '/api/v1/metrics/dora/lead-time',
      queryParameters: queryParams,
    );

    return LeadTimeForChanges.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get all development metrics.
  Future<DevelopmentMetrics> getDevelopmentMetrics({
    DateTime? startDate,
    DateTime? endDate,
    String period = 'week',
    int? repoId,
  }) async {
    final queryParams = <String, dynamic>{
      'period': period,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }

    final response = await _dio.get(
      '/api/v1/metrics/development',
      queryParameters: queryParams,
    );

    return DevelopmentMetrics.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get PR review time metric only.
  Future<PRReviewTime> getPRReviewTime({
    DateTime? startDate,
    DateTime? endDate,
    int? repoId,
    String? authorLogin,
    bool includeTrend = false,
    bool includeBenchmark = false,
  }) async {
    final queryParams = <String, dynamic>{
      'include_trend': includeTrend,
      'include_benchmark': includeBenchmark,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }

    final response = await _dio.get(
      '/api/v1/metrics/development/pr-review-time',
      queryParameters: queryParams,
    );

    return PRReviewTime.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get PR merge time metric only.
  Future<PRMergeTime> getPRMergeTime({
    DateTime? startDate,
    DateTime? endDate,
    int? repoId,
    String? authorLogin,
    bool includeTrend = false,
    bool includeBenchmark = false,
  }) async {
    final queryParams = <String, dynamic>{
      'include_trend': includeTrend,
      'include_benchmark': includeBenchmark,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }

    final response = await _dio.get(
      '/api/v1/metrics/development/pr-merge-time',
      queryParameters: queryParams,
    );

    return PRMergeTime.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get cycle time metric only.
  Future<CycleTime> getCycleTime({
    DateTime? startDate,
    DateTime? endDate,
    int? teamId,
    bool includeBenchmark = false,
  }) async {
    final queryParams = <String, dynamic>{
      'include_benchmark': includeBenchmark,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (teamId != null) {
      queryParams['team_id'] = teamId;
    }

    final response = await _dio.get(
      '/api/v1/metrics/development/cycle-time',
      queryParameters: queryParams,
    );

    return CycleTime.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get throughput metric only.
  Future<Throughput> getThroughput({
    DateTime? startDate,
    DateTime? endDate,
    String period = 'week',
    int? repoId,
    String? authorLogin,
    bool includeTrend = false,
    bool includeBenchmark = false,
  }) async {
    final queryParams = <String, dynamic>{
      'period': period,
      'include_trend': includeTrend,
      'include_benchmark': includeBenchmark,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }

    final response = await _dio.get(
      '/api/v1/metrics/development/throughput',
      queryParameters: queryParams,
    );

    return Throughput.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get anomalies for a specific metric.
  Future<AnomalyResponse> getAnomalies({
    required String metric,
    DateTime? startDate,
    DateTime? endDate,
    String period = 'week',
    int? repoId,
    String? authorLogin,
  }) async {
    final queryParams = <String, dynamic>{
      'metric': metric,
      'period': period,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }

    final response = await _dio.get(
      '/api/v1/metrics/anomalies',
      queryParameters: queryParams,
    );

    return AnomalyResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<PRHealthResponse> getPRHealth({
    DateTime? startDate,
    DateTime? endDate,
    int? repoId,
    String? authorLogin,
    int? minScore,
    int? maxScore,
    bool includeSummary = true,
  }) async {
    final queryParams = <String, dynamic>{
      'include_summary': includeSummary,
    };

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }
    if (authorLogin != null) {
      queryParams['author_login'] = authorLogin;
    }
    if (minScore != null) {
      queryParams['min_score'] = minScore;
    }
    if (maxScore != null) {
      queryParams['max_score'] = maxScore;
    }

    final response = await _dio.get(
      '/api/v1/metrics/pr-health',
      queryParameters: queryParams,
    );

    return PRHealthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ReviewerWorkloadResponse> getReviewerWorkload({
    DateTime? startDate,
    DateTime? endDate,
    int? repoId,
  }) async {
    final queryParams = <String, dynamic>{};

    if (startDate != null) {
      queryParams['start_date'] = startDate.toIso8601String();
    }
    if (endDate != null) {
      queryParams['end_date'] = endDate.toIso8601String();
    }
    if (repoId != null) {
      queryParams['repo_id'] = repoId;
    }

    final response = await _dio.get(
      '/api/v1/metrics/reviewer-workload',
      queryParameters: queryParams,
    );

    return ReviewerWorkloadResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }
}
