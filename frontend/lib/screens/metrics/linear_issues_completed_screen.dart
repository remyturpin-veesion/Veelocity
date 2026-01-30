import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/linear_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart';
import 'metric_detail_screen.dart';

/// Detail screen for Linear Issues Completed metric.
class LinearIssuesCompletedScreen extends ConsumerWidget {
  const LinearIssuesCompletedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(linearIssuesCompletedProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.linearIssuesCompleted,
      onRefresh: () => ref.invalidate(linearIssuesCompletedProvider),
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
      multiRepoChartBuilder: null,
      multiDeveloperChartBuilder: null,
      bottomContentBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (data) => _buildMeasurementsTable(context, data),
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

  Widget _buildSummary(BuildContext context, LinearIssuesCompleted data) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 400;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: isWide
                  ? (constraints.maxWidth - 12) / 2
                  : constraints.maxWidth,
              child: SummaryStatCard(
                label: 'Total completed',
                value: '${data.total}',
                icon: Icons.check_circle_outline,
                color: Colors.teal,
              ),
            ),
            SizedBox(
              width: isWide
                  ? (constraints.maxWidth - 12) / 2
                  : constraints.maxWidth,
              child: SummaryStatCard(
                label: 'Average per period',
                value: data.average.toStringAsFixed(1),
                icon: Icons.trending_up,
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

  Widget _buildContent(BuildContext context, LinearIssuesCompleted data) {
    if (data.data.isEmpty) {
      return Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Icon(
                Icons.info_outline,
                size: 48,
                color: Colors.teal.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'No Issues Completed in Period',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Complete Linear issues in the selected period to see data.',
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
    return const SizedBox.shrink();
  }

  Widget _buildMeasurementsTable(
      BuildContext context, LinearIssuesCompleted data) {
    final measurements = data.data.asMap().entries.map((entry) {
      final d = entry.value;
      return Measurement(
        id: d.period,
        title: _formatPeriodLabel(d.period),
        value: '${d.count} issues',
        timestamp: DateTime.now(),
        sortValue: d.count.toDouble(),
        icon: Icons.check_circle_outline,
        color: Colors.teal,
      );
    }).toList();

    return MeasurementsTable(
      title: 'Issues Completed by Period',
      measurements: measurements,
      showTimestamp: false,
      defaultSort: MeasurementSortOption.newestFirst,
    );
  }

  String _formatPeriodLabel(String period) {
    if (period.contains('-W')) {
      final parts = period.split('-W');
      return 'Week ${parts[1]}, ${parts[0]}';
    }
    return period;
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
