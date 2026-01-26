import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/development_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart';
import 'metric_detail_screen.dart';

/// Detail screen for PR Merge Time metric.
class PRMergeTimeScreen extends ConsumerWidget {
  const PRMergeTimeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(prMergeTimeProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.prMergeTime,
      onRefresh: () => ref.invalidate(prMergeTimeProvider),
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

  Widget _buildSummary(BuildContext context, PRMergeTime data) {
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
                color: Colors.purple,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Median',
                value: formatDuration(data.medianHours),
                icon: Icons.analytics_outlined,
                color: Colors.purple,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'PRs merged',
                value: '${data.count}',
                icon: Icons.merge,
                color: Colors.purple,
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

  Widget _buildContent(BuildContext context, PRMergeTime data) {
    // Note: The current backend doesn't return individual PR measurements
    // for merge time. We show a summary message instead.
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            Icon(
              Icons.merge,
              size: 48,
              color: Colors.purple.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'PR Merge Time Analysis',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Analyzed ${data.count} merged pull requests in the selected period.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            _PerformanceIndicator(
              averageHours: data.averageHours,
              thresholds: const [8, 24, 72], // Elite: <8h, Good: <24h, Needs work: <72h
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
