// Trend data model for period-over-period comparisons.

class TrendData {
  final double currentValue;
  final double previousValue;
  final double changePercent;
  final String direction; // "up", "down", or "flat"
  final bool isImproving;
  final bool isSignificant;

  TrendData({
    required this.currentValue,
    required this.previousValue,
    required this.changePercent,
    required this.direction,
    required this.isImproving,
    required this.isSignificant,
  });

  factory TrendData.fromJson(Map<String, dynamic> json) {
    return TrendData(
      currentValue: (json['current_value'] as num).toDouble(),
      previousValue: (json['previous_value'] as num).toDouble(),
      changePercent: (json['change_percent'] as num).toDouble(),
      direction: json['direction'] as String,
      isImproving: json['is_improving'] as bool,
      isSignificant: json['is_significant'] as bool,
    );
  }

  /// Human-readable description of the trend.
  String get description {
    final absChange = changePercent.abs().toStringAsFixed(1);
    final betterOrWorse = isImproving ? 'better' : 'worse';

    if (direction == 'flat') {
      return 'No significant change from previous period';
    }

    return '$absChange% $betterOrWorse than previous period';
  }
}
