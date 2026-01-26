import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/development_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart';
import '../../widgets/trend_chart.dart';
import 'metric_detail_screen.dart';

/// Detail screen for Throughput metric.
class ThroughputScreen extends ConsumerWidget {
  const ThroughputScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(throughputProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.throughput,
      onRefresh: () => ref.invalidate(throughputProvider),
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

  Widget _buildSummary(BuildContext context, Throughput data) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 400;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: isWide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth,
              child: SummaryStatCard(
                label: 'Average per week',
                value: '${data.average}',
                icon: Icons.trending_up,
                color: Colors.indigo,
              ),
            ),
            SizedBox(
              width: isWide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth,
              child: SummaryStatCard(
                label: 'Total PRs merged',
                value: '${data.total}',
                icon: Icons.merge,
                color: Colors.indigo,
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

  Widget _buildContent(BuildContext context, Throughput data) {
    final measurements = data.data.asMap().entries.map((entry) {
      final d = entry.value;
      final index = entry.key;
      // Use index as a proxy for time ordering (later index = more recent)
      final timestamp = DateTime.now().subtract(Duration(days: (data.data.length - 1 - index) * 7));
      return Measurement(
        id: d.period,
        title: _formatPeriodLabel(d.period),
        value: '${d.count} PRs',
        timestamp: timestamp,
        sortValue: d.count.toDouble(),
        icon: Icons.merge,
        color: Colors.indigo,
      );
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Trend Chart
        if (data.data.isNotEmpty)
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: TrendChart(
                title: 'Throughput Trend',
                data: data.data
                    .map((d) => TrendDataPoint(
                          label: d.period,
                          value: d.count.toDouble(),
                        ))
                    .toList(),
                color: Colors.indigo,
              ),
            ),
          ),
        const SizedBox(height: 24),

        // PRs by Period
        MeasurementsTable(
          title: 'PRs Merged by Period',
          measurements: measurements,
          showTimestamp: false,
          defaultSort: MeasurementSortOption.newestFirst,
        ),
      ],
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
