/// PR Health data models.

/// Health category for a PR.
enum HealthCategory {
  excellent,
  good,
  fair,
  poor;

  static HealthCategory fromString(String value) {
    return values.firstWhere(
      (e) => e.name == value,
      orElse: () => HealthCategory.fair,
    );
  }

  /// Get display label.
  String get label {
    switch (this) {
      case HealthCategory.excellent:
        return 'Excellent';
      case HealthCategory.good:
        return 'Good';
      case HealthCategory.fair:
        return 'Fair';
      case HealthCategory.poor:
        return 'Poor';
    }
  }

  /// Get color for category.
  int get colorValue {
    switch (this) {
      case HealthCategory.excellent:
        return 0xFF4CAF50; // Green
      case HealthCategory.good:
        return 0xFF2196F3; // Blue
      case HealthCategory.fair:
        return 0xFFFFC107; // Amber
      case HealthCategory.poor:
        return 0xFFF44336; // Red
    }
  }
}

/// Component scores for a PR.
class ComponentScores {
  final int review;
  final int comment;
  final int size;
  final int time;

  ComponentScores({
    required this.review,
    required this.comment,
    required this.size,
    required this.time,
  });

  factory ComponentScores.fromJson(Map<String, dynamic> json) {
    return ComponentScores(
      review: json['review'] as int,
      comment: json['comment'] as int,
      size: json['size'] as int,
      time: json['time'] as int,
    );
  }
}

/// Detailed metrics for a PR.
class PRHealthMetrics {
  final int reviewRounds;
  final int commentCount;
  final int linesChanged;
  final double? hoursToFirstReview;
  final double? hoursToMerge;

  PRHealthMetrics({
    required this.reviewRounds,
    required this.commentCount,
    required this.linesChanged,
    this.hoursToFirstReview,
    this.hoursToMerge,
  });

  factory PRHealthMetrics.fromJson(Map<String, dynamic> json) {
    return PRHealthMetrics(
      reviewRounds: json['review_rounds'] as int,
      commentCount: json['comment_count'] as int,
      linesChanged: json['lines_changed'] as int,
      hoursToFirstReview: json['hours_to_first_review'] != null
          ? (json['hours_to_first_review'] as num).toDouble()
          : null,
      hoursToMerge: json['hours_to_merge'] != null
          ? (json['hours_to_merge'] as num).toDouble()
          : null,
    );
  }
}

/// PR health score.
class PRHealthScore {
  final int prNumber;
  final String prTitle;
  final String repository;
  final String author;
  final DateTime? createdAt;
  final DateTime? mergedAt;
  final int healthScore;
  final HealthCategory healthCategory;
  final ComponentScores componentScores;
  final PRHealthMetrics metrics;
  final List<String> issues;

  PRHealthScore({
    required this.prNumber,
    required this.prTitle,
    required this.repository,
    required this.author,
    this.createdAt,
    this.mergedAt,
    required this.healthScore,
    required this.healthCategory,
    required this.componentScores,
    required this.metrics,
    required this.issues,
  });

  factory PRHealthScore.fromJson(Map<String, dynamic> json) {
    return PRHealthScore(
      prNumber: json['pr_number'] as int,
      prTitle: json['pr_title'] as String,
      repository: json['repository'] as String,
      author: json['author'] as String,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      mergedAt: json['merged_at'] != null
          ? DateTime.parse(json['merged_at'] as String)
          : null,
      healthScore: json['health_score'] as int,
      healthCategory:
          HealthCategory.fromString(json['health_category'] as String),
      componentScores: ComponentScores.fromJson(
        json['component_scores'] as Map<String, dynamic>,
      ),
      metrics: PRHealthMetrics.fromJson(
        json['metrics'] as Map<String, dynamic>,
      ),
      issues: (json['issues'] as List<dynamic>).cast<String>(),
    );
  }

  /// Check if PR has issues.
  bool get hasIssues => issues.isNotEmpty;

  /// Get health score as percentage string.
  String get scorePercentage => '$healthScore%';
}

/// Summary statistics for PR health.
class PRHealthSummary {
  final int totalPrs;
  final double averageScore;
  final Map<String, int> byCategory;

  PRHealthSummary({
    required this.totalPrs,
    required this.averageScore,
    required this.byCategory,
  });

  factory PRHealthSummary.fromJson(Map<String, dynamic> json) {
    return PRHealthSummary(
      totalPrs: json['total_prs'] as int,
      averageScore: (json['average_score'] as num).toDouble(),
      byCategory: (json['by_category'] as Map<String, dynamic>).map(
        (key, value) => MapEntry(key, value as int),
      ),
    );
  }
}

/// PR health response.
class PRHealthResponse {
  final String startDate;
  final String endDate;
  final List<PRHealthScore> prHealthScores;
  final int count;
  final PRHealthSummary? summary;

  PRHealthResponse({
    required this.startDate,
    required this.endDate,
    required this.prHealthScores,
    required this.count,
    this.summary,
  });

  factory PRHealthResponse.fromJson(Map<String, dynamic> json) {
    return PRHealthResponse(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      prHealthScores: (json['pr_health_scores'] as List<dynamic>)
          .map((e) => PRHealthScore.fromJson(e as Map<String, dynamic>))
          .toList(),
      count: json['count'] as int,
      summary: json['summary'] != null
          ? PRHealthSummary.fromJson(json['summary'] as Map<String, dynamic>)
          : null,
    );
  }
}
