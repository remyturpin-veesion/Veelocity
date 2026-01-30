import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/alert.dart';
import '../models/anomaly.dart';
import '../models/dora_metrics.dart';
import '../models/recommendation.dart';
import '../services/providers.dart';
import '../widgets/anomaly_badge.dart';

/// Alerts section: anomalies, recommendations, deployment reliability, active alerts.
class AlertsOverviewScreen extends ConsumerWidget {
  const AlertsOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deploymentAnomaliesAsync =
        ref.watch(deploymentFrequencyAnomaliesProvider);
    final throughputAnomaliesAsync = ref.watch(throughputAnomaliesProvider);
    final leadTimeAnomaliesAsync = ref.watch(leadTimeAnomaliesProvider);
    final recommendationsAsync = ref.watch(recommendationsProvider);
    final reliabilityAsync = ref.watch(deploymentReliabilityProvider);
    final alertsAsync = ref.watch(alertsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Alerts',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Anomalies, recommendations, reliability, and active alerts',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),
          _buildAnomaliesCard(
            context,
            deploymentAnomaliesAsync.valueOrNull,
            throughputAnomaliesAsync.valueOrNull,
            leadTimeAnomaliesAsync.valueOrNull,
          ),
          _buildRecommendationsCard(
            context,
            recommendationsAsync.valueOrNull,
          ),
          _buildReliabilityCard(
            context,
            reliabilityAsync.valueOrNull,
          ),
          _buildActiveAlertsCard(
            context,
            alertsAsync.valueOrNull,
          ),
        ],
      ),
    );
  }

  Widget _buildAnomaliesCard(
    BuildContext context,
    AnomalyResponse? deploymentAnomalies,
    AnomalyResponse? throughputAnomalies,
    AnomalyResponse? leadTimeAnomalies,
  ) {
    final allAnomalies = <Anomaly>[
      if (deploymentAnomalies != null) ...deploymentAnomalies.anomalies,
      if (throughputAnomalies != null) ...throughputAnomalies.anomalies,
      if (leadTimeAnomalies != null) ...leadTimeAnomalies.anomalies,
    ];
    if (allAnomalies.isEmpty) return const SizedBox.shrink();

    final totalAnomalies = allAnomalies.length;
    final majorAnomalies =
        allAnomalies.where((a) => a.severity == AnomalySeverity.major).length;
    final minorAnomalies =
        allAnomalies.where((a) => a.severity == AnomalySeverity.minor).length;
    final summary = AnomalySummary(
      totalCount: totalAnomalies,
      majorCount: majorAnomalies,
      minorCount: minorAnomalies,
      severityScore: minorAnomalies + (majorAnomalies * 3),
    );

    final hasMajor = summary.hasMajorAnomalies;
    final color = hasMajor ? Colors.red : Colors.orange;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AlertCard(
          color: color,
          icon: hasMajor ? Icons.error : Icons.warning_amber,
          title: 'Anomalies Detected',
          subtitle: summary.hasMajorAnomalies
              ? '${summary.majorCount} major, ${summary.minorCount} minor anomalies found'
              : '${summary.minorCount} minor anomalies found',
          onTap: () {
            showDialog(
              context: context,
              builder: (context) => AnomalyDetailsDialog(
                anomalies: allAnomalies,
                summary: summary,
              ),
            );
          },
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildRecommendationsCard(
    BuildContext context,
    RecommendationsResponse? recommendations,
  ) {
    if (recommendations == null || recommendations.recommendations.isEmpty) {
      return const SizedBox.shrink();
    }
    final highCount = recommendations.recommendations
        .where((r) => r.priority == 'high')
        .length;
    final total = recommendations.recommendations.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AlertCard(
          color: Colors.blue,
          icon: Icons.lightbulb_outline,
          title: 'Recommendations',
          subtitle: highCount > 0
              ? '$total recommendations ($highCount high priority)'
              : '$total recommendations to improve metrics',
          onTap: () => context.go('/insights/recommendations?tab=github'),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildReliabilityCard(
    BuildContext context,
    DeploymentReliability? reliability,
  ) {
    if (reliability == null || reliability.totalRuns == 0) {
      return const SizedBox.shrink();
    }
    final isHealthy = reliability.stabilityScore >= 90;
    final color = isHealthy ? Colors.green : Colors.orange;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AlertCard(
          color: color,
          icon: isHealthy ? Icons.check_circle_outline : Icons.warning_amber,
          title: 'Deployment reliability',
          subtitle:
              '${reliability.stabilityScore.toStringAsFixed(0)}% stability · '
              '${reliability.failureRate.toStringAsFixed(1)}% failure rate '
              '(${reliability.totalRuns} runs)',
          onTap: () => context.go('/metrics/deployment-frequency?tab=github'),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildActiveAlertsCard(BuildContext context, AlertsResponse? alerts) {
    if (alerts == null || alerts.alerts.isEmpty) {
      return const SizedBox.shrink();
    }
    final highCount = alerts.alerts.where((a) => a.severity == 'high').length;
    final total = alerts.alerts.length;
    final color = highCount > 0 ? Colors.red : Colors.orange;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AlertCard(
          color: color,
          icon: Icons.notification_important,
          title: 'Active alerts',
          subtitle: highCount > 0
              ? '$total alert${total == 1 ? '' : 's'} ($highCount high)'
              : '$total alert${total == 1 ? '' : 's'}',
          onTap: () {
            final theme = Theme.of(context);
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Active Alerts'),
                content: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: alerts.alerts
                        .map(
                          (a) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: a.severity == 'high'
                                            ? Colors.red.withOpacity(0.2)
                                            : Colors.orange.withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        a.severity.toUpperCase(),
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                          color: a.severity == 'high'
                                              ? Colors.red
                                              : Colors.orange,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        a.title,
                                        style: theme.textTheme.titleSmall
                                            ?.copyWith(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  a.message,
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close'),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _AlertCard extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _AlertCard({
    required this.color,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 2,
      color: color.withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.3), width: 2),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 32),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios,
                size: 16,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
