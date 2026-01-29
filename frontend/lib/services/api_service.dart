import 'package:dio/dio.dart';
import '../core/config.dart';
import '../models/pr_detail.dart';

class ApiService {
  late final Dio _dio;

  ApiService() {
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

  Future<Map<String, dynamic>> healthCheck() async {
    final response = await _dio.get('/api/v1/health');
    return response.data;
  }

  Future<T> get<T>(String path) async {
    final response = await _dio.get(path);
    return response.data as T;
  }

  Future<T> post<T>(String path, {Map<String, dynamic>? data}) async {
    final response = await _dio.post(path, data: data);
    return response.data as T;
  }

  /// Get list of synced repositories.
  Future<List<Map<String, dynamic>>> getRepositories() async {
    final response = await _dio.get('/api/v1/repositories');
    final data = response.data as Map<String, dynamic>;
    return (data['items'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  /// Trigger sync of all connectors.
  Future<void> triggerSync() async {
    await _dio.post('/api/v1/connectors/sync');
  }

  /// Get all developers with basic stats.
  Future<Map<String, dynamic>> getDevelopers({
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
      '/api/v1/developers',
      queryParameters: queryParams,
    );
    return response.data as Map<String, dynamic>;
  }

  /// Get detailed stats for a specific developer.
  Future<Map<String, dynamic>> getDeveloperStats(
    String login, {
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
      '/api/v1/developers/$login',
      queryParameters: queryParams,
    );
    return response.data as Map<String, dynamic>;
  }

  /// Get sync coverage data for all repositories.
  Future<Map<String, dynamic>> getSyncCoverage() async {
    final response = await _dio.get('/api/v1/sync/coverage');
    return response.data as Map<String, dynamic>;
  }

  /// Get PR detail for Individual PR Explorer (reviews, comments, commits, optional health).
  Future<PRDetail> getPRDetail(int prId, {bool includeHealth = true}) async {
    final response = await _dio.get(
      '/api/v1/github/prs/$prId',
      queryParameters: {'include_health': includeHealth},
    );
    final data = response.data;
    if (data is Map<String, dynamic> && data.containsKey('error')) {
      throw Exception(data['error'] as String);
    }
    return PRDetail.fromJson(data as Map<String, dynamic>);
  }
}
