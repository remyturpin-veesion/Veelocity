import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/dora_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart';
import 'metric_detail_screen.dart';

/// Detail screen for Lead Time for Changes metric.
class LeadTimeScreen extends ConsumerWidget {
  const LeadTimeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(leadTimeProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.leadTime,
      onRefresh: () => ref.invalidate(leadTimeProvider),
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

  Widget _buildSummary(BuildContext context, LeadTimeForChanges data) {
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
                color: Colors.green,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Median',
                value: formatDuration(data.medianHours),
                icon: Icons.analytics_outlined,
                color: Colors.green,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Deployments',
                value: '${data.count}',
                icon: Icons.rocket_launch,
                color: Colors.green,
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

  Widget _buildContent(BuildContext context, LeadTimeForChanges data) {
    final measurements = data.measurements.map((m) {
      final deployedAt = DateTime.tryParse(m.deployedAt);
      return Measurement(
        id: m.deploymentId.toString(),
        title: 'Deployment #${m.deploymentId}',
        subtitle: 'First commit to deploy',
        value: formatDuration(m.leadTimeHours),
        timestamp: deployedAt,
        sortValue: m.leadTimeHours,
        icon: Icons.timer,
        color: _getLeadTimeColor(m.leadTimeHours),
      );
    }).toList();

    return MeasurementsTable(
      title: 'Recent Deployments',
      measurements: measurements,
      defaultSort: MeasurementSortOption.newestFirst,
    );
  }

  Color _getLeadTimeColor(double hours) {
    if (hours < 1) return Colors.green;
    if (hours < 24) return Colors.blue;
    if (hours < 168) return Colors.orange; // 1 week
    return Colors.red;
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
