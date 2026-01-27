import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/development_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart';
import 'metric_detail_screen.dart';

/// Detail screen for Cycle Time metric.
/// Note: Cycle Time is based on Linear issues and doesn't support per-repo filtering.
class CycleTimeScreen extends ConsumerWidget {
  const CycleTimeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(cycleTimeProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.cycleTime,
      onRefresh: () => ref.invalidate(cycleTimeProvider),
      summaryBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => _buildLoadingSummary(),
          error: (e, _) => _buildErrorSummary(context, e),
          data: (data) => _buildSummary(context, data),
        );
      },
      contentBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _buildError(context, e),
          data: (data) => _buildContent(context, data),
        );
      },
      // Cycle Time doesn't support per-repo filtering (it's based on Linear issues)
      multiRepoChartBuilder: null,
    );
  }

  Widget _buildLoadingSummary() {
    return const Row(
      children: [
        Expanded(child: _SkeletonStatCard()),
        SizedBox(width: 12),
        Expanded(child: _SkeletonStatCard()),
        SizedBox(width: 12),
        Expanded(child: _SkeletonStatCard()),
      ],
    );
  }

  Widget _buildErrorSummary(BuildContext context, Object error) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Failed to load: $error'),
      ),
    );
  }

  Widget _buildSummary(BuildContext context, CycleTime data) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 500;
        final cardWidth = isWide
            ? (constraints.maxWidth - 24) / 3
            : (constraints.maxWidth - 12) / 2;

        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Average',
                value: formatDuration(data.averageHours),
                icon: Icons.access_time,
                color: Colors.teal,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Median',
                value: formatDuration(data.medianHours),
                icon: Icons.analytics_outlined,
                color: Colors.teal,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Issues completed',
                value: '${data.count}',
                icon: Icons.check_circle_outline,
                color: Colors.teal,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildError(BuildContext context, Object error) {
    return Center(
      child: Column(
        children: [
          Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
          const SizedBox(height: 8),
          Text('Error loading data: $error'),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context, CycleTime data) {
    if (data.count == 0) {
      return Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              Icon(
                Icons.info_outline,
                size: 48,
                color: Colors.teal.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'No Cycle Time Data',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Cycle time requires Linear integration and PRs linked to issues. '
                'Make sure your PRs reference Linear issues (e.g., "Fixes ENG-123").',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.grey[600],
                    ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            Icon(
              Icons.loop,
              size: 48,
              color: Colors.teal.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'Cycle Time Analysis',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Analyzed ${data.count} issues with linked PRs in the selected period.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            _PerformanceIndicator(
              averageHours: data.averageHours,
              thresholds: const [
                24,
                72,
                168
              ], // Elite: <1 day, Good: <3 days, Needs work: <1 week
            ),
          ],
        ),
      ),
    );
  }
}

class _PerformanceIndicator extends StatelessWidget {
  final double averageHours;
  final List<int> thresholds;

  const _PerformanceIndicator({
    required this.averageHours,
    required this.thresholds,
  });

  @override
  Widget build(BuildContext context) {
    String rating;
    Color color;
    IconData icon;

    if (averageHours == 0) {
      rating = 'No data';
      color = Colors.grey;
      icon = Icons.remove_circle_outline;
    } else if (averageHours < thresholds[0]) {
      rating = 'Elite';
      color = Colors.green;
      icon = Icons.star;
    } else if (averageHours < thresholds[1]) {
      rating = 'Good';
      color = Colors.blue;
      icon = Icons.thumb_up;
    } else if (averageHours < thresholds[2]) {
      rating = 'Needs improvement';
      color = Colors.orange;
      icon = Icons.trending_up;
    } else {
      rating = 'Critical';
      color = Colors.red;
      icon = Icons.warning;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Text(
            rating,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SkeletonStatCard extends StatelessWidget {
  const _SkeletonStatCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 60,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              width: 80,
              height: 16,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
