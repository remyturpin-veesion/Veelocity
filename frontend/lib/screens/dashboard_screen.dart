import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/anomaly.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';
import '../models/recommendation.dart';
import '../services/providers.dart';
import '../widgets/anomaly_badge.dart';
import '../widgets/kpi_card.dart';
import '../widgets/skeleton_card.dart';

/// Main dashboard screen showing DORA and development metrics.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch individual metric providers to get trend data
    final deploymentFreqAsync = ref.watch(deploymentFrequencyProvider);
    final leadTimeAsync = ref.watch(leadTimeProvider);
    final prReviewTimeAsync = ref.watch(prReviewTimeProvider);
    final prMergeTimeAsync = ref.watch(prMergeTimeProvider);
    final cycleTimeAsync = ref.watch(cycleTimeProvider);
    final throughputAsync = ref.watch(throughputProvider);

    // Watch anomaly providers
    final deploymentAnomaliesAsync =
        ref.watch(deploymentFrequencyAnomaliesProvider);
    final throughputAnomaliesAsync = ref.watch(throughputAnomaliesProvider);
    final leadTimeAnomaliesAsync = ref.watch(leadTimeAnomaliesProvider);

    // Watch Phase 2 insight providers (optional; don't block dashboard)
    final recommendationsAsync = ref.watch(recommendationsProvider);
    final reliabilityAsync = ref.watch(deploymentReliabilityProvider);

    // Show loading if any critical metric is loading
    if (deploymentFreqAsync.isLoading || leadTimeAsync.isLoading) {
      return _buildLoadingState();
    }

    // Show error if any critical metric has error
    if (deploymentFreqAsync.hasError) {
      return _buildErrorState(context, ref, deploymentFreqAsync.error!);
    }

    return _buildDashboard(
      context,
      ref,
      deploymentFreqAsync.value,
      leadTimeAsync.value,
      prReviewTimeAsync.value,
      prMergeTimeAsync.value,
      cycleTimeAsync.value,
      throughputAsync.value,
      deploymentAnomaliesAsync.value,
      throughputAnomaliesAsync.value,
      leadTimeAnomaliesAsync.value,
      recommendationsAsync.value,
      reliabilityAsync.value,
    );
  }

  Widget _buildLoadingState() {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // DORA Metrics skeleton
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: const [
              SizedBox(width: 400, child: KPISkeletonCard()),
              SizedBox(width: 400, child: KPISkeletonCard()),
            ],
          ),
          const SizedBox(height: 32),
          // Development Metrics skeleton
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: const [
              SizedBox(width: 400, child: KPISkeletonCard()),
              SizedBox(width: 400, child: KPISkeletonCard()),
              SizedBox(width: 400, child: KPISkeletonCard()),
              SizedBox(width: 400, child: KPISkeletonCard()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, WidgetRef ref, Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.cloud_off,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Unable to load metrics',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Make sure the backend is running and try again.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () {
                ref.invalidate(deploymentFrequencyProvider);
                ref.invalidate(leadTimeProvider);
                ref.invalidate(prReviewTimeProvider);
                ref.invalidate(prMergeTimeProvider);
                ref.invalidate(cycleTimeProvider);
                ref.invalidate(throughputProvider);
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard(
    BuildContext context,
    WidgetRef ref,
    DeploymentFrequency? deploymentFreq,
    LeadTimeForChanges? leadTime,
    PRReviewTime? prReviewTime,
    PRMergeTime? prMergeTime,
    CycleTime? cycleTime,
    Throughput? throughput,
    AnomalyResponse? deploymentAnomalies,
    AnomalyResponse? throughputAnomalies,
    AnomalyResponse? leadTimeAnomalies,
    RecommendationsResponse? recommendations,
    DeploymentReliability? reliability,
  ) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);

    // Aggregate all anomalies
    final allAnomalies = <Anomaly>[
      if (deploymentAnomalies != null) ...deploymentAnomalies.anomalies,
      if (throughputAnomalies != null) ...throughputAnomalies.anomalies,
      if (leadTimeAnomalies != null) ...leadTimeAnomalies.anomalies,
    ];

    final totalAnomalies = allAnomalies.length;
    final majorAnomalies =
        allAnomalies.where((a) => a.severity == AnomalySeverity.major).length;
    final minorAnomalies =
        allAnomalies.where((a) => a.severity == AnomalySeverity.minor).length;

    final aggregatedSummary = AnomalySummary(
      totalCount: totalAnomalies,
      majorCount: majorAnomalies,
      minorCount: minorAnomalies,
      severityScore: minorAnomalies + (majorAnomalies * 3),
    );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Anomaly Summary Card (if any anomalies detected)
          if (aggregatedSummary.hasAnomalies)
            _buildAnomalyCard(
              context,
              aggregatedSummary,
              allAnomalies,
            ),
          if (aggregatedSummary.hasAnomalies) const SizedBox(height: 24),

          // Recommendations summary (Phase 2 integration)
          if (recommendations != null &&
              recommendations.recommendations.isNotEmpty)
            _buildRecommendationsCard(context, recommendations),
          if (recommendations != null &&
              recommendations.recommendations.isNotEmpty)
            const SizedBox(height: 24),

          // Deployment reliability summary (Phase 2 integration)
          if (reliability != null && reliability.totalRuns > 0)
            _buildReliabilityCard(context, reliability),
          if (reliability != null && reliability.totalRuns > 0)
            const SizedBox(height: 24),

          // DORA Metrics Section
          Text(
            'DORA Metrics',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Last ${selectedPeriod.days} days performance',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 600;
              final cardWidth = isWide
                  ? (constraints.maxWidth - 16) / 2
                  : constraints.maxWidth;
              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  if (deploymentFreq != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Deployment Frequency',
                        value: '${deploymentFreq.average}/week',
                        subtitle: '${deploymentFreq.total} total deployments',
                        icon: Icons.rocket_launch,
                        color: Colors.blue,
                        trend: deploymentFreq.trend,
                        benchmark: deploymentFreq.benchmark,
                        onTap: () => context
                            .go('/metrics/deployment-frequency?tab=dashboard'),
                      ),
                    ),
                  if (leadTime != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Lead Time for Changes',
                        value: _formatDuration(leadTime.averageHours),
                        subtitle:
                            'Median: ${_formatDuration(leadTime.medianHours)}',
                        icon: Icons.timer,
                        color: Colors.green,
                        trend: leadTime.trend,
                        benchmark: leadTime.benchmark,
                        onTap: () =>
                            context.go('/metrics/lead-time?tab=dashboard'),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 32),

          // Development Metrics Section
          Text(
            'Development Metrics',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'PR and cycle time analysis',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 600;
              final cardWidth = isWide
                  ? (constraints.maxWidth - 16) / 2
                  : constraints.maxWidth;
              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  if (prReviewTime != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'PR Review Time',
                        value: _formatDuration(prReviewTime.averageHours),
                        subtitle: '${prReviewTime.count} PRs reviewed',
                        icon: Icons.rate_review,
                        color: Colors.orange,
                        trend: prReviewTime.trend,
                        benchmark: prReviewTime.benchmark,
                        onTap: () =>
                            context.go('/metrics/pr-review-time?tab=dashboard'),
                      ),
                    ),
                  if (prMergeTime != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'PR Merge Time',
                        value: _formatDuration(prMergeTime.averageHours),
                        subtitle: '${prMergeTime.count} PRs merged',
                        icon: Icons.merge,
                        color: Colors.purple,
                        trend: prMergeTime.trend,
                        benchmark: prMergeTime.benchmark,
                        onTap: () =>
                            context.go('/metrics/pr-merge-time?tab=dashboard'),
                      ),
                    ),
                  if (cycleTime != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Cycle Time',
                        value: _formatDuration(cycleTime.averageHours),
                        subtitle: '${cycleTime.count} issues completed',
                        icon: Icons.loop,
                        color: Colors.teal,
                        benchmark: cycleTime.benchmark,
                        onTap: () =>
                            context.go('/metrics/cycle-time?tab=dashboard'),
                      ),
                    ),
                  if (throughput != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Throughput',
                        value: '${throughput.average}/week',
                        subtitle: '${throughput.total} PRs merged total',
                        icon: Icons.speed,
                        color: Colors.indigo,
                        trend: throughput.trend,
                        benchmark: throughput.benchmark,
                        onTap: () =>
                            context.go('/metrics/throughput?tab=dashboard'),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAnomalyCard(
    BuildContext context,
    AnomalySummary summary,
    List<Anomaly> anomalies,
  ) {
    final theme = Theme.of(context);
    final hasMajor = summary.hasMajorAnomalies;
    final color = hasMajor ? Colors.red : Colors.orange;

    return Card(
      elevation: 2,
      color: color.withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.3), width: 2),
      ),
      child: InkWell(
        onTap: () {
          showDialog(
            context: context,
            builder: (context) => AnomalyDetailsDialog(
              anomalies: anomalies,
              summary: summary,
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Icon
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  hasMajor ? Icons.error : Icons.warning_amber,
                  color: color,
                  size: 32,
                ),
              ),
              const SizedBox(width: 16),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '⚠️ Anomalies Detected',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      summary.hasMajorAnomalies
                          ? '${summary.majorCount} major, ${summary.minorCount} minor anomalies found'
                          : '${summary.minorCount} minor anomalies found',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              // Arrow
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

  Widget _buildRecommendationsCard(
    BuildContext context,
    RecommendationsResponse response,
  ) {
    final theme = Theme.of(context);
    final highCount =
        response.recommendations.where((r) => r.priority == 'high').length;
    final total = response.recommendations.length;

    return Card(
      elevation: 2,
      color: Colors.blue.withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.blue.withOpacity(0.3), width: 2),
      ),
      child: InkWell(
        onTap: () => context.go('/insights/recommendations'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.lightbulb_outline,
                  color: Colors.blue,
                  size: 32,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Recommendations',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.blue,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      highCount > 0
                          ? '$total recommendations ($highCount high priority)'
                          : '$total recommendations to improve metrics',
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

  Widget _buildReliabilityCard(
    BuildContext context,
    DeploymentReliability reliability,
  ) {
    final theme = Theme.of(context);
    final isHealthy = reliability.stabilityScore >= 90;
    final color = isHealthy ? Colors.green : Colors.orange;

    return Card(
      elevation: 2,
      color: color.withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.3), width: 2),
      ),
      child: InkWell(
        onTap: () => context.go('/metrics/deployment-frequency?tab=dashboard'),
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
                child: Icon(
                  isHealthy ? Icons.check_circle_outline : Icons.warning_amber,
                  color: color,
                  size: 32,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Deployment reliability',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${reliability.stabilityScore.toStringAsFixed(0)}% stability · '
                      '${reliability.failureRate.toStringAsFixed(1)}% failure rate '
                      '(${reliability.totalRuns} runs)',
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

  String _formatDuration(double hours) {
    if (hours == 0) {
      return 'N/A';
    } else if (hours < 1) {
      return '${(hours * 60).round()} min';
    } else if (hours < 24) {
      return '${hours.toStringAsFixed(1)} hrs';
    } else {
      return '${(hours / 24).toStringAsFixed(1)} days';
    }
  }
}
