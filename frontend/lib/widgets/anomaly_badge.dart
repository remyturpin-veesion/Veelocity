import 'package:flutter/material.dart';
import '../models/anomaly.dart';

/// Badge widget to display anomaly count and severity.
class AnomalyBadge extends StatelessWidget {
  final AnomalySummary summary;
  final VoidCallback? onTap;

  const AnomalyBadge({
    super.key,
    required this.summary,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (!summary.hasAnomalies) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context);
    final hasMajor = summary.hasMajorAnomalies;

    // Color based on severity
    final color = hasMajor ? Colors.red : Colors.orange;
    final icon = hasMajor ? Icons.error : Icons.warning;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          border: Border.all(color: color.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              '${summary.totalCount} ${summary.totalCount == 1 ? 'anomaly' : 'anomalies'}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact anomaly indicator for KPI cards.
class AnomalyIndicator extends StatelessWidget {
  final AnomalySummary summary;
  final VoidCallback? onTap;

  const AnomalyIndicator({
    super.key,
    required this.summary,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (!summary.hasAnomalies) {
      return const SizedBox.shrink();
    }

    final hasMajor = summary.hasMajorAnomalies;
    final color = hasMajor ? Colors.red : Colors.orange;
    final icon = hasMajor ? Icons.error : Icons.warning_amber;

    return Tooltip(
      message: hasMajor
          ? '${summary.majorCount} major, ${summary.minorCount} minor anomalies'
          : '${summary.minorCount} minor anomalies detected',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.all(2),
          child: Icon(
            icon,
            size: 18,
            color: color,
          ),
        ),
      ),
    );
  }
}

/// Dialog to show detailed anomaly information.
class AnomalyDetailsDialog extends StatelessWidget {
  final List<Anomaly> anomalies;
  final AnomalySummary summary;

  const AnomalyDetailsDialog({
    super.key,
    required this.anomalies,
    required this.summary,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AlertDialog(
      title: Row(
        children: [
          Icon(
            summary.hasMajorAnomalies ? Icons.error : Icons.warning,
            color: summary.hasMajorAnomalies ? Colors.red : Colors.orange,
          ),
          const SizedBox(width: 8),
          const Text('Anomalies Detected'),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Summary
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildSummaryItem(
                    context,
                    'Total',
                    summary.totalCount.toString(),
                    Colors.grey,
                  ),
                  _buildSummaryItem(
                    context,
                    'Major',
                    summary.majorCount.toString(),
                    Colors.red,
                  ),
                  _buildSummaryItem(
                    context,
                    'Minor',
                    summary.minorCount.toString(),
                    Colors.orange,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Anomaly list
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: anomalies.length,
                separatorBuilder: (_, __) => const Divider(),
                itemBuilder: (context, index) {
                  final anomaly = anomalies[index];
                  return _buildAnomalyItem(context, anomaly);
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    );
  }

  Widget _buildSummaryItem(
    BuildContext context,
    String label,
    String value,
    Color color,
  ) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Text(
          value,
          style: theme.textTheme.titleLarge?.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _buildAnomalyItem(BuildContext context, Anomaly anomaly) {
    final theme = Theme.of(context);
    final isMajor = anomaly.severity == AnomalySeverity.major;
    final color = isMajor ? Colors.red : Colors.orange;

    return ListTile(
      contentPadding: const EdgeInsets.all(8),
      leading: Icon(
        isMajor ? Icons.error : Icons.warning_amber,
        color: color,
        size: 32,
      ),
      title: Text(
        anomaly.metricName.replaceAll('_', ' ').toUpperCase(),
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          Text(anomaly.explanation),
          const SizedBox(height: 4),
          Row(
            children: [
              Chip(
                label: Text(
                  anomaly.severity.name.toUpperCase(),
                  style: const TextStyle(fontSize: 10),
                ),
                backgroundColor: color.withOpacity(0.1),
                labelStyle:
                    TextStyle(color: color, fontWeight: FontWeight.bold),
                padding: EdgeInsets.zero,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
              const SizedBox(width: 8),
              Text(
                '${anomaly.deviationPercentage.toStringAsFixed(1)}% deviation',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ),
      trailing: Text(
        _formatDate(anomaly.period),
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    try {
      final date = DateTime.parse(isoDate);
      return '${date.month}/${date.day}';
    } catch (e) {
      return isoDate;
    }
  }
}
