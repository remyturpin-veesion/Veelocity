import 'package:flutter/material.dart';
import '../models/trend_data.dart';

/// A compact widget displaying period-over-period trend data.
///
/// Shows an arrow icon with percentage change, color-coded by improvement status.
/// Displays a tooltip with detailed explanation on hover/long press.
class TrendIndicator extends StatelessWidget {
  final TrendData trend;

  const TrendIndicator({
    super.key,
    required this.trend,
  });

  @override
  Widget build(BuildContext context) {
    // Determine color based on improvement status
    final color = _getTrendColor();

    // Determine icon based on direction
    final icon = _getTrendIcon();

    // Format percentage change
    final changeText = trend.direction == 'flat'
        ? 'Stable'
        : '${trend.changePercent.abs().toStringAsFixed(1)}%';

    return Tooltip(
      message: trend.description,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: color.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              changeText,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getTrendColor() {
    if (trend.direction == 'flat') {
      return Colors.grey.shade600;
    }

    // Green for improving, red for degrading
    return trend.isImproving ? Colors.green.shade600 : Colors.red.shade600;
  }

  IconData _getTrendIcon() {
    switch (trend.direction) {
      case 'up':
        return Icons.arrow_upward;
      case 'down':
        return Icons.arrow_downward;
      case 'flat':
      default:
        return Icons.remove;
    }
  }
}
