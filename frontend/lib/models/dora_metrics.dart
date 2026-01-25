// DORA metrics data models.

class DeploymentFrequency {
  final String period;
  final String startDate;
  final String endDate;
  final List<PeriodData> data;
  final int total;
  final double average;

  DeploymentFrequency({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.data,
    required this.total,
    required this.average,
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

class LeadTimeForChanges {
  final String startDate;
  final String endDate;
  final int count;
  final double averageHours;
  final double medianHours;
  final List<LeadTimeMeasurement> measurements;

  LeadTimeForChanges({
    required this.startDate,
    required this.endDate,
    required this.count,
    required this.averageHours,
    required this.medianHours,
    required this.measurements,
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
