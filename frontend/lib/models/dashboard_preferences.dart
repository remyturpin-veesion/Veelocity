/// User preferences for which dashboard sections and KPI cards to show.
class DashboardPreferences {
  const DashboardPreferences({
    this.showSectionAnomalies = true,
    this.showSectionRecommendations = true,
    this.showSectionReliability = true,
    this.showSectionAlerts = true,
    this.showKpiDeploymentFrequency = true,
    this.showKpiLeadTime = true,
    this.showKpiPrReviewTime = true,
    this.showKpiPrMergeTime = true,
    this.showKpiCycleTime = true,
    this.showKpiThroughput = true,
  });

  final bool showSectionAnomalies;
  final bool showSectionRecommendations;
  final bool showSectionReliability;
  final bool showSectionAlerts;
  final bool showKpiDeploymentFrequency;
  final bool showKpiLeadTime;
  final bool showKpiPrReviewTime;
  final bool showKpiPrMergeTime;
  final bool showKpiCycleTime;
  final bool showKpiThroughput;

  static const String _keySectionAnomalies = 'show_section_anomalies';
  static const String _keySectionRecommendations =
      'show_section_recommendations';
  static const String _keySectionReliability = 'show_section_reliability';
  static const String _keySectionAlerts = 'show_section_alerts';
  static const String _keyKpiDeploymentFrequency =
      'show_kpi_deployment_frequency';
  static const String _keyKpiLeadTime = 'show_kpi_lead_time';
  static const String _keyKpiPrReviewTime = 'show_kpi_pr_review_time';
  static const String _keyKpiPrMergeTime = 'show_kpi_pr_merge_time';
  static const String _keyKpiCycleTime = 'show_kpi_cycle_time';
  static const String _keyKpiThroughput = 'show_kpi_throughput';

  static const DashboardPreferences defaultPreferences = DashboardPreferences();

  Map<String, dynamic> toJson() => {
        _keySectionAnomalies: showSectionAnomalies,
        _keySectionRecommendations: showSectionRecommendations,
        _keySectionReliability: showSectionReliability,
        _keySectionAlerts: showSectionAlerts,
        _keyKpiDeploymentFrequency: showKpiDeploymentFrequency,
        _keyKpiLeadTime: showKpiLeadTime,
        _keyKpiPrReviewTime: showKpiPrReviewTime,
        _keyKpiPrMergeTime: showKpiPrMergeTime,
        _keyKpiCycleTime: showKpiCycleTime,
        _keyKpiThroughput: showKpiThroughput,
      };

  static DashboardPreferences fromJson(Map<String, dynamic> json) {
    return DashboardPreferences(
      showSectionAnomalies: json[_keySectionAnomalies] as bool? ?? true,
      showSectionRecommendations:
          json[_keySectionRecommendations] as bool? ?? true,
      showSectionReliability: json[_keySectionReliability] as bool? ?? true,
      showSectionAlerts: json[_keySectionAlerts] as bool? ?? true,
      showKpiDeploymentFrequency:
          json[_keyKpiDeploymentFrequency] as bool? ?? true,
      showKpiLeadTime: json[_keyKpiLeadTime] as bool? ?? true,
      showKpiPrReviewTime: json[_keyKpiPrReviewTime] as bool? ?? true,
      showKpiPrMergeTime: json[_keyKpiPrMergeTime] as bool? ?? true,
      showKpiCycleTime: json[_keyKpiCycleTime] as bool? ?? true,
      showKpiThroughput: json[_keyKpiThroughput] as bool? ?? true,
    );
  }

  DashboardPreferences copyWith({
    bool? showSectionAnomalies,
    bool? showSectionRecommendations,
    bool? showSectionReliability,
    bool? showSectionAlerts,
    bool? showKpiDeploymentFrequency,
    bool? showKpiLeadTime,
    bool? showKpiPrReviewTime,
    bool? showKpiPrMergeTime,
    bool? showKpiCycleTime,
    bool? showKpiThroughput,
  }) {
    return DashboardPreferences(
      showSectionAnomalies: showSectionAnomalies ?? this.showSectionAnomalies,
      showSectionRecommendations:
          showSectionRecommendations ?? this.showSectionRecommendations,
      showSectionReliability:
          showSectionReliability ?? this.showSectionReliability,
      showSectionAlerts: showSectionAlerts ?? this.showSectionAlerts,
      showKpiDeploymentFrequency:
          showKpiDeploymentFrequency ?? this.showKpiDeploymentFrequency,
      showKpiLeadTime: showKpiLeadTime ?? this.showKpiLeadTime,
      showKpiPrReviewTime: showKpiPrReviewTime ?? this.showKpiPrReviewTime,
      showKpiPrMergeTime: showKpiPrMergeTime ?? this.showKpiPrMergeTime,
      showKpiCycleTime: showKpiCycleTime ?? this.showKpiCycleTime,
      showKpiThroughput: showKpiThroughput ?? this.showKpiThroughput,
    );
  }
}
