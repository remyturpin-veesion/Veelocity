import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/linear_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import 'metric_detail_screen.dart';

/// Detail screen for Linear Backlog metric.
class LinearBacklogScreen extends ConsumerWidget {
  const LinearBacklogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(linearBacklogProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.linearBacklog,
      onRefresh: () => ref.invalidate(linearBacklogProvider),
      summaryBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const Row(
            children: [
              Expanded(child: _SkeletonStatCard()),
            ],
          ),
          error: (e, _) => Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Failed to load: $e'),
            ),
          ),
          data: (data) => _buildSummary(context, data),
        );
      },
      contentBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              children: [
                Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
                const SizedBox(height: 8),
                Text('Error: $e'),
              ],
            ),
          ),
          data: (data) => _buildContent(context, data),
        );
      },
      multiRepoChartBuilder: null,
      multiDeveloperChartBuilder: null,
    );
  }

  Widget _buildSummary(BuildContext context, LinearBacklog data) {
    return SummaryStatCard(
      label: 'Open issues',
      value: '${data.backlogCount}',
      icon: Icons.inbox,
      color: Colors.orange,
    );
  }

  Widget _buildContent(BuildContext context, LinearBacklog data) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(
              Icons.inbox,
              size: 48,
              color: Colors.orange.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              '${data.backlogCount} open issues',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Issues not yet completed or canceled. '
              'Compare with Issues Completed to understand flow.',
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
}

class _SkeletonStatCard extends StatelessWidget {
  const _SkeletonStatCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
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
              width: 100,
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
