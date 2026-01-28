/// Models for sync coverage data.

class SyncCoverage {
  final List<ConnectorState> connectors;
  final List<RepositoryCoverage> repositories;
  final int totalPullRequests;
  final int totalCommits;
  final int totalWorkflowRuns;
  final int totalDevelopers;

  SyncCoverage({
    required this.connectors,
    required this.repositories,
    required this.totalPullRequests,
    required this.totalCommits,
    required this.totalWorkflowRuns,
    required this.totalDevelopers,
  });

  factory SyncCoverage.fromJson(Map<String, dynamic> json) {
    return SyncCoverage(
      connectors: (json['connectors'] as List<dynamic>)
          .map((c) => ConnectorState.fromJson(c as Map<String, dynamic>))
          .toList(),
      repositories: (json['repositories'] as List<dynamic>)
          .map((r) => RepositoryCoverage.fromJson(r as Map<String, dynamic>))
          .toList(),
      totalPullRequests: json['total_pull_requests'] as int,
      totalCommits: json['total_commits'] as int,
      totalWorkflowRuns: json['total_workflow_runs'] as int,
      totalDevelopers: json['total_developers'] as int,
    );
  }
}

class ConnectorState {
  final String connectorName;
  final DateTime? lastSyncAt;
  final DateTime? lastFullSyncAt;

  ConnectorState({
    required this.connectorName,
    this.lastSyncAt,
    this.lastFullSyncAt,
  });

  factory ConnectorState.fromJson(Map<String, dynamic> json) {
    return ConnectorState(
      connectorName: json['connector_name'] as String,
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.parse(json['last_sync_at'] as String)
          : null,
      lastFullSyncAt: json['last_full_sync_at'] != null
          ? DateTime.parse(json['last_full_sync_at'] as String)
          : null,
    );
  }

  /// Returns true if connector was synced in the last 24 hours.
  bool get isRecent {
    if (lastSyncAt == null) return false;
    return DateTime.now().difference(lastSyncAt!).inHours < 24;
  }

  /// Returns time since last sync as a human-readable string.
  String get timeSinceSync {
    if (lastSyncAt == null) return 'Never';
    final diff = DateTime.now().difference(lastSyncAt!);
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    return '${diff.inDays} days ago';
  }
}

class RepositoryCoverage {
  final int id;
  final String name;
  final String fullName;
  final int pullRequests;
  final int prsWithDetails; // PRs that have commits fetched
  final int prsWithoutDetails; // PRs still missing details
  final int reviews;
  final int comments;
  final int commits;
  final int workflows;
  final int workflowRuns;
  final DateTime? oldestPrDate;
  final DateTime? newestPrDate;
  final DateTime? oldestCommitDate;
  final DateTime? newestCommitDate;
  final DateTime? oldestWorkflowRunDate;
  final DateTime? newestWorkflowRunDate;

  RepositoryCoverage({
    required this.id,
    required this.name,
    required this.fullName,
    required this.pullRequests,
    required this.prsWithDetails,
    required this.prsWithoutDetails,
    required this.reviews,
    required this.comments,
    required this.commits,
    required this.workflows,
    required this.workflowRuns,
    this.oldestPrDate,
    this.newestPrDate,
    this.oldestCommitDate,
    this.newestCommitDate,
    this.oldestWorkflowRunDate,
    this.newestWorkflowRunDate,
  });

  factory RepositoryCoverage.fromJson(Map<String, dynamic> json) {
    return RepositoryCoverage(
      id: json['id'] as int,
      name: json['name'] as String,
      fullName: json['full_name'] as String,
      pullRequests: json['pull_requests'] as int,
      prsWithDetails: json['prs_with_details'] as int,
      prsWithoutDetails: json['prs_without_details'] as int,
      reviews: json['reviews'] as int,
      comments: json['comments'] as int,
      commits: json['commits'] as int,
      workflows: json['workflows'] as int,
      workflowRuns: json['workflow_runs'] as int,
      oldestPrDate: json['oldest_pr_date'] != null
          ? DateTime.parse(json['oldest_pr_date'] as String)
          : null,
      newestPrDate: json['newest_pr_date'] != null
          ? DateTime.parse(json['newest_pr_date'] as String)
          : null,
      oldestCommitDate: json['oldest_commit_date'] != null
          ? DateTime.parse(json['oldest_commit_date'] as String)
          : null,
      newestCommitDate: json['newest_commit_date'] != null
          ? DateTime.parse(json['newest_commit_date'] as String)
          : null,
      oldestWorkflowRunDate: json['oldest_workflow_run_date'] != null
          ? DateTime.parse(json['oldest_workflow_run_date'] as String)
          : null,
      newestWorkflowRunDate: json['newest_workflow_run_date'] != null
          ? DateTime.parse(json['newest_workflow_run_date'] as String)
          : null,
    );
  }

  /// Returns the date range of PR data as a formatted string.
  String get prDateRange {
    if (oldestPrDate == null || newestPrDate == null) return 'No data';
    return '${_formatDate(oldestPrDate!)} - ${_formatDate(newestPrDate!)}';
  }

  /// Returns the date range of commit data as a formatted string.
  String get commitDateRange {
    if (oldestCommitDate == null || newestCommitDate == null) return 'No data';
    return '${_formatDate(oldestCommitDate!)} - ${_formatDate(newestCommitDate!)}';
  }

  /// Returns the date range of workflow run data as a formatted string.
  String get workflowRunDateRange {
    if (oldestWorkflowRunDate == null || newestWorkflowRunDate == null) {
      return 'No data';
    }
    return '${_formatDate(oldestWorkflowRunDate!)} - ${_formatDate(newestWorkflowRunDate!)}';
  }

  /// Returns true if data is stale (newest PR older than 7 days).
  bool get isStale {
    if (newestPrDate == null) return true;
    return DateTime.now().difference(newestPrDate!).inDays > 7;
  }

  /// Returns true if all PRs have their details fetched.
  bool get isComplete => prsWithoutDetails == 0;

  /// Returns true if details (commits/reviews) are missing for some PRs.
  bool get isMissingDetails => prsWithoutDetails > 0;

  /// Progress percentage of detail fetching (0-100).
  double get completionPercent {
    if (pullRequests == 0) return 100.0;
    return (prsWithDetails / pullRequests) * 100;
  }

  /// Returns the sync status.
  SyncStatus get status {
    if (pullRequests == 0) return SyncStatus.noData;
    if (isMissingDetails) return SyncStatus.incomplete;
    if (isStale) return SyncStatus.stale;
    return SyncStatus.upToDate;
  }
}

enum SyncStatus {
  noData, // No PRs synced
  incomplete, // PRs synced but missing details (commits/reviews)
  stale, // Data older than 7 days
  upToDate, // Fully synced and recent
}

String _formatDate(DateTime date) {
  return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}
