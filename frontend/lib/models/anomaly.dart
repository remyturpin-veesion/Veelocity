/// Anomaly detection models.

/// Represents a detected anomaly in metric data.
class Anomaly {
  final String metricName;
  final String period; // ISO date string
  final double value;
  final AnomalyExpectedRange expectedRange;
  final AnomalySeverity severity;
  final String explanation;
  final double deviationPercentage;

  Anomaly({
    required this.metricName,
    required this.period,
    required this.value,
    required this.expectedRange,
    required this.severity,
    required this.explanation,
    required this.deviationPercentage,
  });

  factory Anomaly.fromJson(Map<String, dynamic> json) {
    return Anomaly(
      metricName: json['metric_name'] as String,
      period: json['period'] as String,
      value: (json['value'] as num).toDouble(),
      expectedRange: AnomalyExpectedRange.fromJson(
        json['expected_range'] as Map<String, dynamic>,
      ),
      severity: AnomalySeverity.fromString(json['severity'] as String),
      explanation: json['explanation'] as String,
      deviationPercentage: (json['deviation_percentage'] as num).toDouble(),
    );
  }
}

/// Expected range for anomaly detection.
class AnomalyExpectedRange {
  final double min;
  final double max;

  AnomalyExpectedRange({
    required this.min,
    required this.max,
  });

  factory AnomalyExpectedRange.fromJson(Map<String, dynamic> json) {
    return AnomalyExpectedRange(
      min: (json['min'] as num).toDouble(),
      max: (json['max'] as num).toDouble(),
    );
  }
}

/// Severity level of an anomaly.
enum AnomalySeverity {
  minor,
  major;

  static AnomalySeverity fromString(String value) {
    return values.firstWhere(
      (e) => e.name == value,
      orElse: () => AnomalySeverity.minor,
    );
  }
}

/// Summary statistics for anomalies.
class AnomalySummary {
  final int totalCount;
  final int minorCount;
  final int majorCount;
  final int severityScore;

  AnomalySummary({
    required this.totalCount,
    required this.minorCount,
    required this.majorCount,
    required this.severityScore,
  });

  factory AnomalySummary.fromJson(Map<String, dynamic> json) {
    return AnomalySummary(
      totalCount: json['total_count'] as int,
      minorCount: json['minor_count'] as int,
      majorCount: json['major_count'] as int,
      severityScore: json['severity_score'] as int,
    );
  }

  /// Check if there are any anomalies.
  bool get hasAnomalies => totalCount > 0;

  /// Check if there are any major anomalies.
  bool get hasMajorAnomalies => majorCount > 0;
}

/// Response from anomaly detection endpoint.
class AnomalyResponse {
  final List<Anomaly> anomalies;
  final AnomalySummary summary;

  AnomalyResponse({
    required this.anomalies,
    required this.summary,
  });

  factory AnomalyResponse.fromJson(Map<String, dynamic> json) {
    return AnomalyResponse(
      anomalies: (json['anomalies'] as List)
          .map((e) => Anomaly.fromJson(e as Map<String, dynamic>))
          .toList(),
      summary: AnomalySummary.fromJson(
        json['summary'] as Map<String, dynamic>,
      ),
    );
  }
}
