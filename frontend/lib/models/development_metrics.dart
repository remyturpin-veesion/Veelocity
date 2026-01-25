// Development metrics models.

/// PR Review Time metric.
class PRReviewTime {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;

  PRReviewTime({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
  });

  factory PRReviewTime.fromJson(Map<String, dynamic> json) {
    return PRReviewTime(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
    );
  }
}

/// PR Merge Time metric.
class PRMergeTime {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;

  PRMergeTime({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
  });

  factory PRMergeTime.fromJson(Map<String, dynamic> json) {
    return PRMergeTime(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
    );
  }
}

/// Cycle Time metric.
class CycleTime {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;

  CycleTime({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
  });

  factory CycleTime.fromJson(Map<String, dynamic> json) {
    return CycleTime(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
    );
  }
}

/// Throughput period data.
class ThroughputPeriod {
  final String period;
  final int count;

  ThroughputPeriod({required this.period, required this.count});

  factory ThroughputPeriod.fromJson(Map<String, dynamic> json) {
    return ThroughputPeriod(
      period: json['period'] as String,
      count: json['count'] as int,
    );
  }
}

/// Throughput metric.
class Throughput {
  final String period;
  final String startDate;
  final String endDate;
  final List<ThroughputPeriod> data;
  final int total;
  final double average;

  Throughput({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.data,
    required this.total,
    required this.average,
  });

  factory Throughput.fromJson(Map<String, dynamic> json) {
    return Throughput(
      period: json['period'] as String,
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      data: (json['data'] as List<dynamic>)
          .map((e) => ThroughputPeriod.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int,
      average: (json['average'] as num).toDouble(),
    );
  }
}

/// All development metrics combined.
class DevelopmentMetrics {
  final PRReviewTime prReviewTime;
  final PRMergeTime prMergeTime;
  final CycleTime cycleTime;
  final Throughput throughput;

  DevelopmentMetrics({
    required this.prReviewTime,
    required this.prMergeTime,
    required this.cycleTime,
    required this.throughput,
  });

  factory DevelopmentMetrics.fromJson(Map<String, dynamic> json) {
    return DevelopmentMetrics(
      prReviewTime:
          PRReviewTime.fromJson(json['pr_review_time'] as Map<String, dynamic>),
      prMergeTime:
          PRMergeTime.fromJson(json['pr_merge_time'] as Map<String, dynamic>),
      cycleTime: CycleTime.fromJson(json['cycle_time'] as Map<String, dynamic>),
      throughput: Throughput.fromJson(json['throughput'] as Map<String, dynamic>),
    );
  }
}
