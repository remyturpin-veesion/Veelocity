import 'package:dio/dio.dart';
import '../core/config.dart';

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
}
