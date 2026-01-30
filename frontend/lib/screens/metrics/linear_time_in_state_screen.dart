import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/linear_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import 'metric_detail_screen.dart';

/// Detail screen for Linear Time in State metric.
/// Shows workflow stages (Backlog → In progress) with filters and stats (min, max, median, average).
class LinearTimeInStateScreen extends ConsumerWidget {
  const LinearTimeInStateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(linearTimeInStateProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.linearTimeInState,
      onRefresh: () => ref.invalidate(linearTimeInStateProvider),
      summaryBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const Row(
            children: [
              Expanded(child: _SkeletonStatCard()),
              SizedBox(width: 12),
              Expanded(child: _SkeletonStatCard()),
              SizedBox(width: 12),
              Expanded(child: _SkeletonStatCard()),
              SizedBox(width: 12),
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

  Widget _buildSummary(BuildContext context, LinearTimeInState data) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 600;
        final cardWidth = isWide
            ? (constraints.maxWidth - 36) / 4
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
                color: Colors.deepPurple,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Median',
                value: formatDuration(data.medianHours),
                icon: Icons.analytics_outlined,
                color: Colors.deepPurple,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Min / Max',
                value: data.count > 0
                    ? '${formatDuration(data.minHours)} / ${formatDuration(data.maxHours)}'
                    : '—',
                icon: Icons.straighten,
                color: Colors.deepPurple,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Issues',
                value: '${data.count}',
                icon: Icons.check_circle_outline,
                color: Colors.deepPurple,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildContent(BuildContext context, LinearTimeInState data) {
    if (data.count == 0) {
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
                color: Colors.deepPurple.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'No Time in State Data',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Complete Linear issues (with started_at set) in the selected period. Use period and team filters above.',
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Workflow by status',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (int i = 0; i < data.stages.length; i++) ...[
                  _WorkflowStageCard(
                    stage: data.stages[i],
                    formatDuration: formatDuration,
                    color: Colors.deepPurple,
                  ),
                  if (i < data.stages.length - 1)
                    _WorkflowArrow(color: Colors.deepPurple),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  static String formatDuration(double hours) {
    if (hours == 0) return 'N/A';
    if (hours < 1) return '${(hours * 60).round()}m';
    if (hours < 24) return '${hours.toStringAsFixed(1)}h';
    return '${(hours / 24).toStringAsFixed(1)}d';
  }
}

class _WorkflowStageCard extends StatelessWidget {
  const _WorkflowStageCard({
    required this.stage,
    required this.formatDuration,
    required this.color,
  });

  final LinearTimeInStateStage stage;
  final String Function(double) formatDuration;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final hasCount = stage.count > 0;
    final hasTimeStats = hasCount &&
        (stage.medianHours > 0 ||
            stage.averageHours > 0 ||
            stage.minHours > 0 ||
            stage.maxHours > 0);
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child:
                      Icon(Icons.account_tree_outlined, color: color, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    stage.label,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _StatRow(label: 'Issues', value: '${stage.count}'),
            if (hasTimeStats) ...[
              _StatRow(
                  label: 'Median', value: formatDuration(stage.medianHours)),
              _StatRow(
                  label: 'Average', value: formatDuration(stage.averageHours)),
              _StatRow(label: 'Min', value: formatDuration(stage.minHours)),
              _StatRow(label: 'Max', value: formatDuration(stage.maxHours)),
            ] else if (!hasCount)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'No issues',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _WorkflowArrow extends StatelessWidget {
  const _WorkflowArrow({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Center(
        child: Icon(
          Icons.arrow_forward,
          size: 28,
          color: color.withValues(alpha: 0.6),
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
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
