/// Workload data for a single reviewer.
class ReviewerWorkload {
  final String reviewerLogin;
  final int reviewCount;
  final double avgReviewsPerWeek;
  final double percentageOfTotal;
  final bool isBottleneck;
  final bool isUnderUtilized;

  const ReviewerWorkload({
    required this.reviewerLogin,
    required this.reviewCount,
    required this.avgReviewsPerWeek,
    required this.percentageOfTotal,
    required this.isBottleneck,
    required this.isUnderUtilized,
  });

  factory ReviewerWorkload.fromJson(Map<String, dynamic> json) {
    return ReviewerWorkload(
      reviewerLogin: json['reviewer_login'] as String,
      reviewCount: json['review_count'] as int,
      avgReviewsPerWeek: (json['avg_reviews_per_week'] as num).toDouble(),
      percentageOfTotal: (json['percentage_of_total'] as num).toDouble(),
      isBottleneck: json['is_bottleneck'] as bool,
      isUnderUtilized: json['is_under_utilized'] as bool,
    );
  }
}

/// Summary statistics for review workload.
class WorkloadSummary {
  final int totalReviews;
  final int uniqueReviewers;
  final double avgReviewsPerReviewer;
  final int maxReviews;
  final int minReviews;
  final double giniCoefficient;
  final bool hasBottleneck;
  final List<String> bottleneckReviewers;

  const WorkloadSummary({
    required this.totalReviews,
    required this.uniqueReviewers,
    required this.avgReviewsPerReviewer,
    required this.maxReviews,
    required this.minReviews,
    required this.giniCoefficient,
    required this.hasBottleneck,
    required this.bottleneckReviewers,
  });

  factory WorkloadSummary.fromJson(Map<String, dynamic> json) {
    return WorkloadSummary(
      totalReviews: json['total_reviews'] as int,
      uniqueReviewers: json['unique_reviewers'] as int,
      avgReviewsPerReviewer:
          (json['avg_reviews_per_reviewer'] as num).toDouble(),
      maxReviews: json['max_reviews'] as int,
      minReviews: json['min_reviews'] as int,
      giniCoefficient: (json['gini_coefficient'] as num).toDouble(),
      hasBottleneck: json['has_bottleneck'] as bool,
      bottleneckReviewers: (json['bottleneck_reviewers'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );
  }
}

/// API response for reviewer workload.
class ReviewerWorkloadResponse {
  final String startDate;
  final String endDate;
  final List<ReviewerWorkload> workloads;
  final WorkloadSummary summary;

  const ReviewerWorkloadResponse({
    required this.startDate,
    required this.endDate,
    required this.workloads,
    required this.summary,
  });

  factory ReviewerWorkloadResponse.fromJson(Map<String, dynamic> json) {
    return ReviewerWorkloadResponse(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      workloads: (json['workloads'] as List<dynamic>)
          .map((e) => ReviewerWorkload.fromJson(e as Map<String, dynamic>))
          .toList(),
      summary: WorkloadSummary.fromJson(
        json['summary'] as Map<String, dynamic>,
      ),
    );
  }
}
