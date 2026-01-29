/// A single pairwise correlation between two metrics.
class CorrelationPair {
  final String metricA;
  final String metricB;
  final double correlation;
  final int periodCount;

  CorrelationPair({
    required this.metricA,
    required this.metricB,
    required this.correlation,
    required this.periodCount,
  });

  factory CorrelationPair.fromJson(Map<String, dynamic> json) {
    return CorrelationPair(
      metricA: json['metric_a'] as String,
      metricB: json['metric_b'] as String,
      correlation: (json['correlation'] as num).toDouble(),
      periodCount: json['period_count'] as int,
    );
  }

  /// Human-readable label for metric (e.g. deployment_frequency -> Deployment Frequency).
  static String metricLabel(String key) {
    switch (key) {
      case 'deployment_frequency':
        return 'Deployment Frequency';
      case 'throughput':
        return 'Throughput';
      case 'lead_time':
        return 'Lead Time';
      default:
        return key
            .replaceAll('_', ' ')
            .split(' ')
            .map((s) => s.isEmpty
                ? ''
                : '${s[0].toUpperCase()}${s.substring(1).toLowerCase()}')
            .join(' ');
    }
  }
}

/// Response from the correlations API.
class CorrelationsResponse {
  final String startDate;
  final String endDate;
  final String period;
  final List<CorrelationPair> pairs;

  CorrelationsResponse({
    required this.startDate,
    required this.endDate,
    required this.period,
    required this.pairs,
  });

  factory CorrelationsResponse.fromJson(Map<String, dynamic> json) {
    return CorrelationsResponse(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      period: json['period'] as String,
      pairs: (json['pairs'] as List<dynamic>)
          .map((e) => CorrelationPair.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
