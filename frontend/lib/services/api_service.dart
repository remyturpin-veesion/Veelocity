import 'package:dio/dio.dart';
import '../core/config.dart';
import '../models/pr_detail.dart';

/// Export format for metrics report.
enum ExportFormat { json, csv }

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

  /// Get public/masked settings (no secrets). Keys: github_configured, github_repos, linear_configured, linear_workspace_name, storage_available.
  Future<Map<String, dynamic>> getSettings() async {
    final response = await _dio.get('/api/v1/settings');
    return response.data as Map<String, dynamic>;
  }

  /// Update settings. Only include keys that changed; leave blank to keep current. Secrets are encrypted at rest.
  Future<Map<String, dynamic>> updateSettings({
    String? githubToken,
    String? githubRepos,
    String? linearApiKey,
    String? linearWorkspaceName,
  }) async {
    final body = <String, dynamic>{};
    if (githubToken != null) body['github_token'] = githubToken;
    if (githubRepos != null) body['github_repos'] = githubRepos;
    if (linearApiKey != null) body['linear_api_key'] = linearApiKey;
    if (linearWorkspaceName != null)
      body['linear_workspace_name'] = linearWorkspaceName;
    final response = await _dio.put('/api/v1/settings', data: body);
    return response.data as Map<String, dynamic>;
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

  /// Force import data for a single day or date range (GitHub PRs and/or Linear issues).
  /// [connector] is "github", "linear", or "all".
  Future<Map<String, dynamic>> triggerImportRange({
    required DateTime startDate,
    DateTime? endDate,
    String connector = 'all',
  }) async {
    final start = _toDateString(startDate);
    final end = endDate != null ? _toDateString(endDate) : null;
    final response = await _dio.post(
      '/api/v1/sync/import-range',
      data: {
        'start_date': start,
        if (end != null) 'end_date': end,
        'connector': connector,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  static String _toDateString(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Get Linear teams (paginated).
  Future<Map<String, dynamic>> getLinearTeams({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _dio.get(
      '/api/v1/linear/teams',
      queryParameters: {'page': page, 'limit': limit},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Get Linear issues (paginated, optional filters).
  Future<Map<String, dynamic>> getLinearIssues({
    int? teamId,
    String? state,
    bool? linked,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, dynamic>{'page': page, 'limit': limit};
    if (teamId != null) queryParams['team_id'] = teamId;
    if (state != null) queryParams['state'] = state;
    if (linked != null) queryParams['linked'] = linked;

    final response = await _dio.get(
      '/api/v1/linear/issues',
      queryParameters: queryParams,
    );
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

  /// Build full URL for export report (JSON or CSV). Use with url_launcher to open or download.
  String getExportReportUrl({
    required DateTime startDate,
    required DateTime endDate,
    int? repoId,
    required ExportFormat format,
  }) {
    final params = <String, String>{
      'start_date': startDate.toIso8601String(),
      'end_date': endDate.toIso8601String(),
      'format': format == ExportFormat.csv ? 'csv' : 'json',
    };
    if (repoId != null) {
      params['repo_id'] = repoId.toString();
    }
    final query = params.entries
        .map((e) =>
            '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
        .join('&');
    return '${AppConfig.apiBaseUrl}/api/v1/export/report?$query';
  }
}
