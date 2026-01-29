// DORA metrics data models.

import 'benchmark_data.dart';
import 'trend_data.dart';

class DeploymentFrequency {
  final String period;
  final String startDate;
  final String endDate;
  final List<PeriodData> data;
  final int total;
  final double average;
  final TrendData? trend;
  final BenchmarkData? benchmark;

  DeploymentFrequency({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.data,
    required this.total,
    required this.average,
    this.trend,
    this.benchmark,
  });

  factory DeploymentFrequency.fromJson(Map<String, dynamic> json) {
    return DeploymentFrequency(
      period: json['period'] as String,
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      data: (json['data'] as List)
          .map((e) => PeriodData.fromJson(e as Map<String, dynamic>))
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

class PeriodData {
  final String period;
  final int count;

  PeriodData({required this.period, required this.count});

  factory PeriodData.fromJson(Map<String, dynamic> json) {
    return PeriodData(
      period: json['period'] as String,
      count: json['count'] as int,
    );
  }
}

/// Deployment reliability: failure rate, MTTR, stability score.
class DeploymentReliability {
  final String startDate;
  final String endDate;
  final int totalRuns;
  final int successfulRuns;
  final int failedRuns;
  final int cancelledRuns;
  final double failureRate;
  final double? mttrHours;
  final double stabilityScore;

  DeploymentReliability({
    required this.startDate,
    required this.endDate,
    required this.totalRuns,
    required this.successfulRuns,
    required this.failedRuns,
    required this.cancelledRuns,
    required this.failureRate,
    this.mttrHours,
    required this.stabilityScore,
  });

  factory DeploymentReliability.fromJson(Map<String, dynamic> json) {
    return DeploymentReliability(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      totalRuns: json['total_runs'] as int,
      successfulRuns: json['successful_runs'] as int,
      failedRuns: json['failed_runs'] as int,
      cancelledRuns: json['cancelled_runs'] as int,
      failureRate: (json['failure_rate'] as num).toDouble(),
      mttrHours: json['mttr_hours'] != null
          ? (json['mttr_hours'] as num).toDouble()
          : null,
      stabilityScore: (json['stability_score'] as num).toDouble(),
    );
  }
}

class LeadTimeForChanges {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;
  final List<LeadTimeMeasurement> measurements;
  final TrendData? trend;
  final BenchmarkData? benchmark;

  LeadTimeForChanges({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
    required this.measurements,
    this.trend,
    this.benchmark,
  });

  factory LeadTimeForChanges.fromJson(Map<String, dynamic> json) {
    return LeadTimeForChanges(
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      count: json['count'] as int,
      averageHours: (json['average_hours'] as num).toDouble(),
      medianHours: (json['median_hours'] as num).toDouble(),
      measurements: (json['measurements'] as List)
          .map((e) => LeadTimeMeasurement.fromJson(e as Map<String, dynamic>))
          .toList(),
      trend: json['trend'] != null
          ? TrendData.fromJson(json['trend'] as Map<String, dynamic>)
          : null,
      benchmark: json['benchmark'] != null
          ? BenchmarkData.fromJson(json['benchmark'] as Map<String, dynamic>)
          : null,
    );
  }
}

class LeadTimeMeasurement {
  final int deploymentId;
  final String firstCommitAt;
  final String deployedAt;
  final double leadTimeHours;

  LeadTimeMeasurement({
    required this.deploymentId,
    required this.firstCommitAt,
    required this.deployedAt,
    required this.leadTimeHours,
  });

  factory LeadTimeMeasurement.fromJson(Map<String, dynamic> json) {
    return LeadTimeMeasurement(
      deploymentId: json['deployment_id'] as int,
      firstCommitAt: json['first_commit_at'] as String,
      deployedAt: json['deployed_at'] as String,
      leadTimeHours: (json['lead_time_hours'] as num).toDouble(),
    );
  }
}

class DORAMetrics {
  final DeploymentFrequency deploymentFrequency;
  final LeadTimeForChanges leadTimeForChanges;

  DORAMetrics({
    required this.deploymentFrequency,
    required this.leadTimeForChanges,
  });

  factory DORAMetrics.fromJson(Map<String, dynamic> json) {
    return DORAMetrics(
      deploymentFrequency: DeploymentFrequency.fromJson(
          json['deployment_frequency'] as Map<String, dynamic>),
      leadTimeForChanges: LeadTimeForChanges.fromJson(
          json['lead_time_for_changes'] as Map<String, dynamic>),
    );
  }
}
