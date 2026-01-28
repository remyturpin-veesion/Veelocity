import 'package:flutter/material.dart';
import '../models/benchmark_data.dart';

/// Badge widget to display benchmark category and performance level.
class BenchmarkBadge extends StatelessWidget {
  final BenchmarkData benchmark;
  final bool compact;

  const BenchmarkBadge({
    super.key,
    required this.benchmark,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = Color(benchmark.category.colorValue);

    if (compact) {
      return _buildCompactBadge(theme, color);
    }

    return _buildFullBadge(theme, color);
  }

  Widget _buildCompactBadge(ThemeData theme, Color color) {
    return Tooltip(
      message:
          '${benchmark.category.label} performance\n${benchmark.description}',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: color.withValues(alpha: 0.4),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getCategoryIcon(),
              size: 12,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              benchmark.category.label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFullBadge(ThemeData theme, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _getCategoryIcon(),
            size: 16,
            color: color,
          ),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                benchmark.category.label,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'Performance',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: color.withValues(alpha: 0.8),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getCategoryIcon() {
    switch (benchmark.category) {
      case BenchmarkCategory.elite:
        return Icons.stars;
      case BenchmarkCategory.high:
        return Icons.trending_up;
      case BenchmarkCategory.medium:
        return Icons.show_chart;
      case BenchmarkCategory.low:
        return Icons.trending_down;
    }
  }
}

/// Detailed benchmark information card.
class BenchmarkInfoCard extends StatelessWidget {
  final BenchmarkData benchmark;

  const BenchmarkInfoCard({
    super.key,
    required this.benchmark,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = Color(benchmark.category.colorValue);

    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  Icons.emoji_events,
                  color: color,
                  size: 24,
                ),
                const SizedBox(width: 8),
                Text(
                  'Industry Benchmark',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Current performance
            _buildInfoRow(
              context,
              'Your Performance',
              benchmark.category.label,
              color,
            ),
            const SizedBox(height: 8),
            _buildInfoRow(
              context,
              'Description',
              benchmark.description,
              theme.colorScheme.onSurface,
            ),
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 12),

            // Thresholds
            Text(
              'Performance Tiers',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            _buildThresholdRow(
              context,
              'Elite',
              _formatThreshold(
                benchmark.thresholds.elite,
                benchmark.improvementDirection,
              ),
              Color(BenchmarkCategory.elite.colorValue),
            ),
            const SizedBox(height: 4),
            _buildThresholdRow(
              context,
              'High',
              _formatThreshold(
                benchmark.thresholds.high,
                benchmark.improvementDirection,
              ),
              Color(BenchmarkCategory.high.colorValue),
            ),
            const SizedBox(height: 4),
            _buildThresholdRow(
              context,
              'Medium',
              _formatThreshold(
                benchmark.thresholds.medium,
                benchmark.improvementDirection,
              ),
              Color(BenchmarkCategory.medium.colorValue),
            ),
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 12),

            // Gap to elite
            if (!benchmark.isElite)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Colors.blue.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.lightbulb_outline,
                      color: Colors.blue,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        benchmark.gapToElite,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: Colors.blue.shade700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    BuildContext context,
    String label,
    String value,
    Color valueColor,
  ) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 140,
          child: Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildThresholdRow(
    BuildContext context,
    String tier,
    String threshold,
    Color color,
  ) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 60,
          child: Text(
            tier,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(
          threshold,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  String _formatThreshold(double value, ImprovementDirection direction) {
    final prefix = direction == ImprovementDirection.lower ? '<' : '≥';

    if (value < 1) {
      return '$prefix ${value.toStringAsFixed(2)}';
    } else if (value < 24) {
      return '$prefix ${value.toStringAsFixed(1)} hrs';
    } else if (value < 168) {
      return '$prefix ${(value / 24).toStringAsFixed(1)} days';
    } else {
      return '$prefix ${(value / 168).toStringAsFixed(1)} weeks';
    }
  }
}
