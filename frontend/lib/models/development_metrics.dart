// Development metrics models.

import 'benchmark_data.dart';
import 'trend_data.dart';

/// PR Review Time metric.
class PRReviewTime {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;
  final TrendData? trend;
  final BenchmarkData? benchmark;

  PRReviewTime({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
    this.trend,
    this.benchmark,
  });

  factory PRReviewTime.fromJson(Map<String, dynamic> json) {
    return PRReviewTime(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
      trend: json['trend'] != null
          ? TrendData.fromJson(json['trend'] as Map<String, dynamic>)
          : null,
      benchmark: json['benchmark'] != null
          ? BenchmarkData.fromJson(json['benchmark'] as Map<String, dynamic>)
          : null,
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
  final TrendData? trend;
  final BenchmarkData? benchmark;

  PRMergeTime({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
    this.trend,
    this.benchmark,
  });

  factory PRMergeTime.fromJson(Map<String, dynamic> json) {
    return PRMergeTime(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
      trend: json['trend'] != null
          ? TrendData.fromJson(json['trend'] as Map<String, dynamic>)
          : null,
      benchmark: json['benchmark'] != null
          ? BenchmarkData.fromJson(json['benchmark'] as Map<String, dynamic>)
          : null,
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
  final BenchmarkData? benchmark;

  CycleTime({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
    this.benchmark,
  });

  factory CycleTime.fromJson(Map<String, dynamic> json) {
    return CycleTime(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
      benchmark: json['benchmark'] != null
          ? BenchmarkData.fromJson(json['benchmark'] as Map<String, dynamic>)
          : null,
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
  final TrendData? trend;
  final BenchmarkData? benchmark;

  Throughput({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.data,
    required this.total,
    required this.average,
    this.trend,
    this.benchmark,
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
      trend: json['trend'] != null
          ? TrendData.fromJson(json['trend'] as Map<String, dynamic>)
          : null,
      benchmark: json['benchmark'] != null
          ? BenchmarkData.fromJson(json['benchmark'] as Map<String, dynamic>)
          : null,
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
      throughput:
          Throughput.fromJson(json['throughput'] as Map<String, dynamic>),
    );
  }
}
