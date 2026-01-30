// Linear-native metrics and entity models.

/// Linear overview for dashboard: issues completed, backlog, time-in-state.
class LinearOverview {
  final String startDate;
  final String endDate;
  final int issuesCompleted;
  final double issuesCompletedPerWeek;
  final int backlogCount;
  final double timeInStateAverageHours;
  final double timeInStateMedianHours;
  final int timeInStateCount;

  LinearOverview({
    required this.startDate,
    required this.endDate,
    required this.issuesCompleted,
    required this.issuesCompletedPerWeek,
    required this.backlogCount,
    required this.timeInStateAverageHours,
    required this.timeInStateMedianHours,
    required this.timeInStateCount,
  });

  factory LinearOverview.fromJson(Map<String, dynamic> json) {
    return LinearOverview(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      issuesCompleted: json['issues_completed'] as int,
      issuesCompletedPerWeek:
          (json['issues_completed_per_week'] as num).toDouble(),
      backlogCount: json['backlog_count'] as int,
      timeInStateAverageHours:
          (json['time_in_state_average_hours'] as num).toDouble(),
      timeInStateMedianHours:
          (json['time_in_state_median_hours'] as num).toDouble(),
      timeInStateCount: json['time_in_state_count'] as int,
    );
  }
}

/// Issues completed per period (time series).
class LinearIssuesCompleted {
  final String period;
  final String startDate;
  final String endDate;
  final List<LinearIssuesCompletedDataPoint> data;
  final int total;
  final double average;

  LinearIssuesCompleted({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.data,
    required this.total,
    required this.average,
  });

  factory LinearIssuesCompleted.fromJson(Map<String, dynamic> json) {
    final dataList = json['data'] as List<dynamic>? ?? [];
    return LinearIssuesCompleted(
      period: json['period'] as String,
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      data: dataList
          .map((e) => LinearIssuesCompletedDataPoint.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int,
      average: (json['average'] as num).toDouble(),
    );
  }
}

class LinearIssuesCompletedDataPoint {
  final String period;
  final int count;

  LinearIssuesCompletedDataPoint({
    required this.period,
    required this.count,
  });

  factory LinearIssuesCompletedDataPoint.fromJson(Map<String, dynamic> json) {
    return LinearIssuesCompletedDataPoint(
      period: json['period'] as String,
      count: json['count'] as int,
    );
  }
}

/// Backlog count (open issues).
class LinearBacklog {
  final int backlogCount;

  LinearBacklog({required this.backlogCount});

  factory LinearBacklog.fromJson(Map<String, dynamic> json) {
    return LinearBacklog(backlogCount: json['backlog_count'] as int);
  }
}

/// Time from issue created→started (backlog) and started→completed (in progress).
class LinearTimeInState {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;
  final double minHours;
  final double maxHours;
  final List<LinearTimeInStateStage> stages;

  LinearTimeInState({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
    required this.minHours,
    required this.maxHours,
    required this.stages,
  });

  factory LinearTimeInState.fromJson(Map<String, dynamic> json) {
    final stagesList = json['stages'] as List<dynamic>? ?? [];
    return LinearTimeInState(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
      minHours: (json['min_hours'] as num?)?.toDouble() ?? 0.0,
      maxHours: (json['max_hours'] as num?)?.toDouble() ?? 0.0,
      stages: stagesList
          .map(
              (e) => LinearTimeInStateStage.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// One workflow stage (e.g. Todo, In Progress, In Review) with issue count and optional time stats.
class LinearTimeInStateStage {
  final String id;
  final String label;
  final int count;
  final double minHours;
  final double maxHours;
  final double medianHours;
  final double averageHours;
  final double? position;

  LinearTimeInStateStage({
    required this.id,
    required this.label,
    required this.count,
    required this.minHours,
    required this.maxHours,
    required this.medianHours,
    required this.averageHours,
    this.position,
  });

  factory LinearTimeInStateStage.fromJson(Map<String, dynamic> json) {
    return LinearTimeInStateStage(
      id: json['id'] as String,
      label: json['label'] as String,
      count: json['count'] as int,
      minHours: (json['min_hours'] as num).toDouble(),
      maxHours: (json['max_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
      averageHours: (json['average_hours'] as num).toDouble(),
      position: (json['position'] as num?)?.toDouble(),
    );
  }
}

/// Linear team (list item).
class LinearTeam {
  final int id;
  final String linearId;
  final String name;
  final String key;

  LinearTeam({
    required this.id,
    required this.linearId,
    required this.name,
    required this.key,
  });

  factory LinearTeam.fromJson(Map<String, dynamic> json) {
    return LinearTeam(
      id: json['id'] as int,
      linearId: json['linear_id'] as String,
      name: json['name'] as String,
      key: json['key'] as String,
    );
  }
}

/// Linear issue (list item).
class LinearIssue {
  final int id;
  final String linearId;
  final String identifier;
  final String title;
  final String state;
  final int priority;
  final String? assigneeName;
  final DateTime? createdAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final int? linkedPrId;

  LinearIssue({
    required this.id,
    required this.linearId,
    required this.identifier,
    required this.title,
    required this.state,
    required this.priority,
    this.assigneeName,
    this.createdAt,
    this.startedAt,
    this.completedAt,
    this.linkedPrId,
  });

  factory LinearIssue.fromJson(Map<String, dynamic> json) {
    return LinearIssue(
      id: json['id'] as int,
      linearId: json['linear_id'] as String,
      identifier: json['identifier'] as String,
      title: json['title'] as String,
      state: json['state'] as String,
      priority: json['priority'] as int,
      assigneeName: json['assignee_name'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      startedAt: json['started_at'] != null
          ? DateTime.parse(json['started_at'] as String)
          : null,
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'] as String)
          : null,
      linkedPrId: json['linked_pr_id'] as int?,
    );
  }
}

/// Paginated response for Linear teams or issues.
class LinearPaginatedResponse<T> {
  final List<T> items;
  final int total;
  final int page;
  final int limit;
  final int pages;
  final bool hasNext;
  final bool hasPrev;

  LinearPaginatedResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.pages,
    required this.hasNext,
    required this.hasPrev,
  });
}
