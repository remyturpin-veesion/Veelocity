import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/providers.dart';
import '../widgets/kpi_card.dart';
import '../widgets/skeleton_card.dart';

/// GitHub section overview: DORA, Development, and Insights links.
class GitHubOverviewScreen extends ConsumerWidget {
  const GitHubOverviewScreen({super.key});

  static String _formatDuration(double? hours) {
    if (hours == null || hours == 0) return 'N/A';
    if (hours < 1) return '${(hours * 60).round()}m';
    if (hours < 24) return '${hours.toStringAsFixed(1)}h';
    return '${(hours / 24).toStringAsFixed(1)}d';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deploymentFreqAsync = ref.watch(deploymentFrequencyProvider);
    final leadTimeAsync = ref.watch(leadTimeProvider);
    final prReviewTimeAsync = ref.watch(prReviewTimeProvider);
    final prMergeTimeAsync = ref.watch(prMergeTimeProvider);
    final cycleTimeAsync = ref.watch(cycleTimeProvider);
    final throughputAsync = ref.watch(throughputProvider);
    final selectedPeriod = ref.watch(selectedPeriodProvider);

    if (deploymentFreqAsync.isLoading || leadTimeAsync.isLoading) {
      return _buildLoadingState();
    }
    if (deploymentFreqAsync.hasError) {
      return _buildErrorState(context, ref, deploymentFreqAsync.error!);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'GitHub',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'DORA and development metrics from your repositories',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),

          // DORA
          Text(
            'DORA Metrics',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Last ${selectedPeriod.days} days',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 16),
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
                  if (deploymentFreqAsync.value != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Deployment Frequency',
                        value: '${deploymentFreqAsync.value!.average}/week',
                        subtitle:
                            '${deploymentFreqAsync.value!.total} total deployments',
                        icon: Icons.rocket_launch,
                        color: Colors.blue,
                        trend: deploymentFreqAsync.value!.trend,
                        benchmark: deploymentFreqAsync.value!.benchmark,
                        onTap: () => context
                            .go('/metrics/deployment-frequency?tab=github'),
                      ),
                    ),
                  if (leadTimeAsync.value != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Lead Time for Changes',
                        value:
                            _formatDuration(leadTimeAsync.value!.averageHours),
                        subtitle:
                            'Median: ${_formatDuration(leadTimeAsync.value!.medianHours)}',
                        icon: Icons.timer,
                        color: Colors.green,
                        trend: leadTimeAsync.value!.trend,
                        benchmark: leadTimeAsync.value!.benchmark,
                        onTap: () =>
                            context.go('/metrics/lead-time?tab=github'),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 32),

          // Development
          Text(
            'Development Metrics',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'PR and cycle time',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 600;
              final cardWidth = isWide
                  ? (constraints.maxWidth - 32) / 2
                  : constraints.maxWidth;
              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  if (prReviewTimeAsync.value != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'PR Review Time',
                        value: _formatDuration(
                            prReviewTimeAsync.value!.averageHours),
                        subtitle:
                            '${prReviewTimeAsync.value!.count} PRs reviewed',
                        icon: Icons.rate_review,
                        color: Colors.orange,
                        trend: prReviewTimeAsync.value!.trend,
                        benchmark: prReviewTimeAsync.value!.benchmark,
                        onTap: () =>
                            context.go('/metrics/pr-review-time?tab=github'),
                      ),
                    ),
                  if (prMergeTimeAsync.value != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'PR Merge Time',
                        value: _formatDuration(
                            prMergeTimeAsync.value!.averageHours),
                        subtitle: '${prMergeTimeAsync.value!.count} PRs merged',
                        icon: Icons.merge,
                        color: Colors.purple,
                        trend: prMergeTimeAsync.value!.trend,
                        benchmark: prMergeTimeAsync.value!.benchmark,
                        onTap: () =>
                            context.go('/metrics/pr-merge-time?tab=github'),
                      ),
                    ),
                  if (cycleTimeAsync.value != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Cycle Time',
                        value:
                            _formatDuration(cycleTimeAsync.value!.averageHours),
                        subtitle:
                            '${cycleTimeAsync.value!.count} issues completed',
                        icon: Icons.loop,
                        color: Colors.teal,
                        benchmark: cycleTimeAsync.value!.benchmark,
                        onTap: () =>
                            context.go('/metrics/cycle-time?tab=github'),
                      ),
                    ),
                  if (throughputAsync.value != null)
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Throughput',
                        value: '${throughputAsync.value!.average}/week',
                        subtitle:
                            '${throughputAsync.value!.total} PRs merged total',
                        icon: Icons.speed,
                        color: Colors.indigo,
                        trend: throughputAsync.value!.trend,
                        benchmark: throughputAsync.value!.benchmark,
                        onTap: () =>
                            context.go('/metrics/throughput?tab=github'),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 32),

          // Insights
          Text(
            'Insights',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              _InsightCard(
                title: 'PR Health',
                subtitle: 'Review and merge quality',
                icon: Icons.health_and_safety,
                color: Colors.red.shade700,
                onTap: () => context.go('/metrics/pr-health?tab=github'),
              ),
              _InsightCard(
                title: 'Reviewer Workload',
                subtitle: 'Balance across reviewers',
                icon: Icons.people_outline,
                color: Colors.amber.shade700,
                onTap: () =>
                    context.go('/metrics/reviewer-workload?tab=github'),
              ),
              _InsightCard(
                title: 'Recommendations',
                subtitle: 'Improvement suggestions',
                icon: Icons.lightbulb_outline,
                color: Colors.blue,
                onTap: () => context.go('/insights/recommendations?tab=github'),
              ),
              _InsightCard(
                title: 'Correlations',
                subtitle: 'Metric relationships',
                icon: Icons.show_chart,
                color: Colors.green.shade700,
                onTap: () => context.go('/insights/correlations?tab=github'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              SizedBox(width: 280, child: KPISkeletonCard()),
              SizedBox(width: 280, child: KPISkeletonCard()),
            ],
          ),
          SizedBox(height: 32),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              SizedBox(width: 280, child: KPISkeletonCard()),
              SizedBox(width: 280, child: KPISkeletonCard()),
              SizedBox(width: 280, child: KPISkeletonCard()),
              SizedBox(width: 280, child: KPISkeletonCard()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, WidgetRef ref, Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Unable to load GitHub metrics',
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
}

class _InsightCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _InsightCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: color, size: 24),
                ),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
