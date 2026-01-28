import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/development_metrics.dart';
import '../models/dora_metrics.dart';
import '../services/providers.dart';
import '../widgets/kpi_card.dart';
import '../widgets/skeleton_card.dart';

/// Main dashboard screen showing DORA and development metrics.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doraAsync = ref.watch(doraMetricsProvider);
    final devAsync = ref.watch(developmentMetricsProvider);

    return doraAsync.when(
      loading: () => _buildLoadingState(),
      error: (error, stack) => _buildErrorState(context, ref, error),
      data: (doraMetrics) => devAsync.when(
        loading: () => _buildDashboard(context, ref, doraMetrics, null),
        error: (_, __) => _buildDashboard(context, ref, doraMetrics, null),
        data: (devMetrics) =>
            _buildDashboard(context, ref, doraMetrics, devMetrics),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonGrid(count: 2),
          SizedBox(height: 32),
          SkeletonGrid(count: 4),
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
                ref.invalidate(doraMetricsProvider);
                ref.invalidate(developmentMetricsProvider);
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
    DORAMetrics dora,
    DevelopmentMetrics? dev,
  ) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                  SizedBox(
                    width: cardWidth,
                    child: KPICard(
                      title: 'Deployment Frequency',
                      value: '${dora.deploymentFrequency.average}/week',
                      subtitle:
                          '${dora.deploymentFrequency.total} total deployments',
                      icon: Icons.rocket_launch,
                      color: Colors.blue,
                      onTap: () => context.go('/metrics/deployment-frequency?tab=dashboard'),
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: KPICard(
                      title: 'Lead Time for Changes',
                      value:
                          _formatDuration(dora.leadTimeForChanges.averageHours),
                      subtitle:
                          'Median: ${_formatDuration(dora.leadTimeForChanges.medianHours)}',
                      icon: Icons.timer,
                      color: Colors.green,
                      onTap: () => context.go('/metrics/lead-time?tab=dashboard'),
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
          if (dev != null)
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
                        title: 'PR Review Time',
                        value: _formatDuration(dev.prReviewTime.averageHours),
                        subtitle: '${dev.prReviewTime.count} PRs reviewed',
                        icon: Icons.rate_review,
                        color: Colors.orange,
                        onTap: () => context.go('/metrics/pr-review-time?tab=dashboard'),
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'PR Merge Time',
                        value: _formatDuration(dev.prMergeTime.averageHours),
                        subtitle: '${dev.prMergeTime.count} PRs merged',
                        icon: Icons.merge,
                        color: Colors.purple,
                        onTap: () => context.go('/metrics/pr-merge-time?tab=dashboard'),
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Cycle Time',
                        value: _formatDuration(dev.cycleTime.averageHours),
                        subtitle: '${dev.cycleTime.count} issues completed',
                        icon: Icons.loop,
                        color: Colors.teal,
                        onTap: () => context.go('/metrics/cycle-time?tab=dashboard'),
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Throughput',
                        value: '${dev.throughput.average}/week',
                        subtitle: '${dev.throughput.total} PRs merged total',
                        icon: Icons.speed,
                        color: Colors.indigo,
                        onTap: () => context.go('/metrics/throughput?tab=dashboard'),
                      ),
                    ),
                  ],
                );
              },
            )
          else
            const SkeletonGrid(count: 4),
        ],
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
