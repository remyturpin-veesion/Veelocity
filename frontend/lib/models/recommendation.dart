/// A single recommendation from the recommendation engine.
class Recommendation {
  final String id;
  final String title;
  final String description;
  final String priority;
  final String? metricContext;

  Recommendation({
    required this.id,
    required this.title,
    required this.description,
    required this.priority,
    this.metricContext,
  });

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    return Recommendation(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      priority: json['priority'] as String,
      metricContext: json['metric_context'] as String?,
    );
  }
}

/// Response from the recommendations API.
class RecommendationsResponse {
  final String startDate;
  final String endDate;
  final List<Recommendation> recommendations;

  RecommendationsResponse({
    required this.startDate,
    required this.endDate,
    required this.recommendations,
  });

  factory RecommendationsResponse.fromJson(Map<String, dynamic> json) {
    return RecommendationsResponse(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      recommendations: (json['recommendations'] as List)
          .map((e) => Recommendation.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
