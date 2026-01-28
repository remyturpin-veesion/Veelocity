/// Benchmark data models for industry comparisons.

/// Performance category based on industry benchmarks.
enum BenchmarkCategory {
  elite,
  high,
  medium,
  low;

  static BenchmarkCategory fromString(String value) {
    return values.firstWhere(
      (e) => e.name == value,
      orElse: () => BenchmarkCategory.medium,
    );
  }

  /// Get display label for category.
  String get label {
    switch (this) {
      case BenchmarkCategory.elite:
        return 'Elite';
      case BenchmarkCategory.high:
        return 'High';
      case BenchmarkCategory.medium:
        return 'Medium';
      case BenchmarkCategory.low:
        return 'Low';
    }
  }

  /// Get color for category.
  int get colorValue {
    switch (this) {
      case BenchmarkCategory.elite:
        return 0xFF4CAF50; // Green
      case BenchmarkCategory.high:
        return 0xFF2196F3; // Blue
      case BenchmarkCategory.medium:
        return 0xFFFFC107; // Amber
      case BenchmarkCategory.low:
        return 0xFFF44336; // Red
    }
  }
}

/// Improvement direction for a metric.
enum ImprovementDirection {
  higher,
  lower;

  static ImprovementDirection fromString(String value) {
    return values.firstWhere(
      (e) => e.name == value,
      orElse: () => ImprovementDirection.higher,
    );
  }
}

/// Threshold values for benchmark categories.
class BenchmarkThresholds {
  final double elite;
  final double high;
  final double medium;

  BenchmarkThresholds({
    required this.elite,
    required this.high,
    required this.medium,
  });

  factory BenchmarkThresholds.fromJson(Map<String, dynamic> json) {
    return BenchmarkThresholds(
      elite: (json['elite'] as num).toDouble(),
      high: (json['high'] as num).toDouble(),
      medium: (json['medium'] as num).toDouble(),
    );
  }
}

/// Benchmark comparison data for a metric.
class BenchmarkData {
  final BenchmarkCategory category;
  final String description;
  final double yourValue;
  final BenchmarkThresholds thresholds;
  final String gapToElite;
  final ImprovementDirection improvementDirection;

  BenchmarkData({
    required this.category,
    required this.description,
    required this.yourValue,
    required this.thresholds,
    required this.gapToElite,
    required this.improvementDirection,
  });

  factory BenchmarkData.fromJson(Map<String, dynamic> json) {
    return BenchmarkData(
      category: BenchmarkCategory.fromString(json['category'] as String),
      description: json['description'] as String,
      yourValue: (json['your_value'] as num).toDouble(),
      thresholds: BenchmarkThresholds.fromJson(
        json['thresholds'] as Map<String, dynamic>,
      ),
      gapToElite: json['gap_to_elite'] as String,
      improvementDirection: ImprovementDirection.fromString(
        json['improvement_direction'] as String,
      ),
    );
  }

  /// Check if performance is at elite level.
  bool get isElite => category == BenchmarkCategory.elite;

  /// Check if performance needs improvement (medium or low).
  bool get needsImprovement =>
      category == BenchmarkCategory.medium || category == BenchmarkCategory.low;
}
