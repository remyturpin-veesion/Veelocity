/// A single active alert from the alert rules engine.
class Alert {
  final String ruleId;
  final String title;
  final String message;
  final String severity;
  final String metric;
  final Object currentValue;
  final String threshold;

  Alert({
    required this.ruleId,
    required this.title,
    required this.message,
    required this.severity,
    required this.metric,
    required this.currentValue,
    required this.threshold,
  });

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      ruleId: json['rule_id'] as String,
      title: json['title'] as String,
      message: json['message'] as String,
      severity: json['severity'] as String,
      metric: json['metric'] as String,
      currentValue: json['current_value'],
      threshold: json['threshold'] as String,
    );
  }
}

/// Response from the alerts API.
class AlertsResponse {
  final String startDate;
  final String endDate;
  final List<Alert> alerts;

  AlertsResponse({
    required this.startDate,
    required this.endDate,
    required this.alerts,
  });

  factory AlertsResponse.fromJson(Map<String, dynamic> json) {
    return AlertsResponse(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      alerts: (json['alerts'] as List<dynamic>)
          .map((e) => Alert.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
