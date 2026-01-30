import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';
import '../models/linear_metrics.dart';
import '../services/dashboard_preferences_provider.dart';
import '../services/providers.dart';
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

    final linearOverviewAsync = ref.watch(linearOverviewProvider);

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
      linearOverviewAsync,
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
    AsyncValue<LinearOverview> linearOverviewAsync,
  ) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final prefs = ref.watch(dashboardPreferencesProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // At a glance: key numbers in one compact row
          _buildAtAGlanceRow(
            context,
            deploymentFreq,
            leadTime,
            prMergeTime,
            throughput,
            linearOverviewAsync,
          ),
          const SizedBox(height: 24),

          // DORA Metrics Section (only if at least one KPI is visible)
          if (prefs.showKpiDeploymentFrequency || prefs.showKpiLeadTime) ...[
            Row(
              children: [
                Text(
                  'DORA Metrics',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(width: 12),
                TextButton(
                  onPressed: () => context.go('/github?tab=github'),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('See more in GitHub'),
                ),
              ],
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
                    if (prefs.showKpiDeploymentFrequency &&
                        deploymentFreq != null)
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
                              .go('/metrics/deployment-frequency?tab=github'),
                        ),
                      ),
                    if (prefs.showKpiLeadTime && leadTime != null)
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
                              context.go('/metrics/lead-time?tab=github'),
                        ),
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: 32),
          ],

          // Development Metrics Section (only if at least one KPI is visible)
          if (prefs.showKpiPrReviewTime ||
              prefs.showKpiPrMergeTime ||
              prefs.showKpiCycleTime ||
              prefs.showKpiThroughput) ...[
            Row(
              children: [
                Text(
                  'Development Metrics',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(width: 12),
                TextButton(
                  onPressed: () => context.go('/github?tab=github'),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('See more in GitHub'),
                ),
              ],
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
                    if (prefs.showKpiPrReviewTime && prReviewTime != null)
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
                              context.go('/metrics/pr-review-time?tab=github'),
                        ),
                      ),
                    if (prefs.showKpiPrMergeTime && prMergeTime != null)
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
                              context.go('/metrics/pr-merge-time?tab=github'),
                        ),
                      ),
                    if (prefs.showKpiCycleTime && cycleTime != null)
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
                              context.go('/metrics/cycle-time?tab=github'),
                        ),
                      ),
                    if (prefs.showKpiThroughput && throughput != null)
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
                              context.go('/metrics/throughput?tab=github'),
                        ),
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: 32),
          ],

          // Linear section (issues completed, backlog, time-in-state)
          _buildLinearSection(context, ref, linearOverviewAsync),
        ],
      ),
    );
  }

  Widget _buildLinearSection(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<LinearOverview> linearOverviewAsync,
  ) {
    return linearOverviewAsync.when(
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Linear',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Issues and backlog',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),
          const Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              SizedBox(width: 400, child: KPISkeletonCard()),
              SizedBox(width: 400, child: KPISkeletonCard()),
              SizedBox(width: 400, child: KPISkeletonCard()),
            ],
          ),
        ],
      ),
      error: (err, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Linear',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.grey[600]),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Linear data unavailable. Check connection and sync.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      data: (overview) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Linear',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              TextButton.icon(
                onPressed: () => context.go('/linear?tab=linear'),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('See more in Linear'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Issues and backlog',
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
                  SizedBox(
                    width: cardWidth,
                    child: KPICard(
                      title: 'Issues completed',
                      value: '${overview.issuesCompleted}',
                      subtitle:
                          '${overview.issuesCompletedPerWeek.toStringAsFixed(1)}/week avg',
                      icon: Icons.check_circle_outline,
                      color: Colors.teal,
                      onTap: () => context
                          .go('/metrics/linear/issues-completed?tab=linear'),
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: KPICard(
                      title: 'Backlog',
                      value: '${overview.backlogCount}',
                      subtitle: 'open issues',
                      icon: Icons.inbox,
                      color: Colors.orange,
                      onTap: () =>
                          context.go('/metrics/linear/backlog?tab=linear'),
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: KPICard(
                      title: 'Time in state',
                      value: _formatDuration(overview.timeInStateAverageHours),
                      subtitle:
                          '${overview.timeInStateCount} issues · median ${_formatDuration(overview.timeInStateMedianHours)}',
                      icon: Icons.schedule,
                      color: Colors.deepPurple,
                      onTap: () => context
                          .go('/metrics/linear/time-in-state?tab=linear'),
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

  /// Compact "at a glance" row with key numbers (deployments, lead time, merge time, throughput, Linear).
  Widget _buildAtAGlanceRow(
    BuildContext context,
    DeploymentFrequency? deploymentFreq,
    LeadTimeForChanges? leadTime,
    PRMergeTime? prMergeTime,
    Throughput? throughput,
    AsyncValue<LinearOverview> linearOverviewAsync,
  ) {
    final items = <Widget>[];
    if (deploymentFreq != null) {
      items.add(_GlanceChip(
        label: 'Deploys',
        value: '${deploymentFreq.average}/wk',
        onTap: () => context.go('/metrics/deployment-frequency?tab=github'),
      ));
    }
    if (leadTime != null) {
      items.add(_GlanceChip(
        label: 'Lead time',
        value: _formatDuration(leadTime.averageHours),
        onTap: () => context.go('/metrics/lead-time?tab=github'),
      ));
    }
    if (prMergeTime != null) {
      items.add(_GlanceChip(
        label: 'PR merge',
        value: _formatDuration(prMergeTime.averageHours),
        onTap: () => context.go('/metrics/pr-merge-time?tab=github'),
      ));
    }
    if (throughput != null) {
      items.add(_GlanceChip(
        label: 'Throughput',
        value: '${throughput.average}/wk',
        onTap: () => context.go('/metrics/throughput?tab=github'),
      ));
    }
    final overview = linearOverviewAsync.valueOrNull;
    if (overview != null) {
      items.add(_GlanceChip(
        label: 'Issues done',
        value: '${overview.issuesCompleted}',
        onTap: () => context.go('/metrics/linear/issues-completed?tab=linear'),
      ));
      items.add(_GlanceChip(
        label: 'Backlog',
        value: '${overview.backlogCount}',
        onTap: () => context.go('/metrics/linear/backlog?tab=linear'),
      ));
    }
    if (items.isEmpty) return const SizedBox.shrink();
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              'At a glance',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[600],
                  ),
            ),
            const SizedBox(width: 4),
            ...items,
          ],
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

/// Compact chip for the at-a-glance row (label: value, tappable).
class _GlanceChip extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;

  const _GlanceChip({
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$label: ',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            Text(
              value,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
