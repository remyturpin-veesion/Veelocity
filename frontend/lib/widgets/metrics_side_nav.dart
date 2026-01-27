import 'package:flutter/material.dart';
import '../models/metric_info.dart';
import '../screens/metrics/deployment_frequency_screen.dart';
import '../screens/metrics/lead_time_screen.dart';
import '../screens/metrics/pr_review_time_screen.dart';
import '../screens/metrics/pr_merge_time_screen.dart';
import '../screens/metrics/cycle_time_screen.dart';
import '../screens/metrics/throughput_screen.dart';

/// Navigation item for the metrics sidebar.
class _MetricNavItem {
  final MetricInfo info;
  final Widget Function() screenBuilder;

  const _MetricNavItem({
    required this.info,
    required this.screenBuilder,
  });
}

/// Slim sidebar navigation for switching between metric detail screens.
///
/// Displays icons for each metric with tooltips on hover.
/// The current metric is highlighted.
class MetricsSideNav extends StatelessWidget {
  /// ID of the currently displayed metric (null if on home).
  final String? currentMetricId;

  /// Whether we're on the home/dashboard screen.
  final bool isHome;

  /// Callback when home is tapped (used when navigating from metric screens).
  final VoidCallback? onHomeTap;

  /// Width of the navigation rail.
  final double width;

  const MetricsSideNav({
    super.key,
    this.currentMetricId,
    this.isHome = false,
    this.onHomeTap,
    this.width = 56,
  });

  static final List<_MetricNavItem> _items = [
    _MetricNavItem(
      info: MetricInfo.deploymentFrequency,
      screenBuilder: () => const DeploymentFrequencyScreen(),
    ),
    _MetricNavItem(
      info: MetricInfo.leadTime,
      screenBuilder: () => const LeadTimeScreen(),
    ),
    _MetricNavItem(
      info: MetricInfo.prReviewTime,
      screenBuilder: () => const PRReviewTimeScreen(),
    ),
    _MetricNavItem(
      info: MetricInfo.prMergeTime,
      screenBuilder: () => const PRMergeTimeScreen(),
    ),
    _MetricNavItem(
      info: MetricInfo.cycleTime,
      screenBuilder: () => const CycleTimeScreen(),
    ),
    _MetricNavItem(
      info: MetricInfo.throughput,
      screenBuilder: () => const ThroughputScreen(),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: width,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(
          right: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 8),
          // Home button
          _buildHomeItem(context, colorScheme),
          const SizedBox(height: 8),
          const Divider(height: 1, indent: 8, endIndent: 8),
          const SizedBox(height: 8),
          // DORA section
          const _SectionDivider(label: 'DORA'),
          ..._items.take(2).map((item) => _buildNavItem(context, item)),
          const SizedBox(height: 8),
          // Development section
          const _SectionDivider(label: 'Dev'),
          ..._items.skip(2).map((item) => _buildNavItem(context, item)),
          const Spacer(),
        ],
      ),
    );
  }

  Widget _buildHomeItem(BuildContext context, ColorScheme colorScheme) {
    return Tooltip(
      message: 'Dashboard',
      preferBelow: false,
      waitDuration: const Duration(milliseconds: 300),
      child: InkWell(
        onTap: isHome
            ? null
            : () {
                if (onHomeTap != null) {
                  onHomeTap!();
                } else {
                  // Simply pop back to the dashboard
                  Navigator.of(context).pop();
                }
              },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12),
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: isHome
                ? colorScheme.primary.withValues(alpha: 0.15)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: isHome
                ? Border.all(
                    color: colorScheme.primary.withValues(alpha: 0.3),
                    width: 1,
                  )
                : null,
          ),
          child: Icon(
            Icons.dashboard,
            size: 22,
            color: isHome ? colorScheme.primary : colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, _MetricNavItem item) {
    final isSelected = item.info.id == currentMetricId;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Tooltip(
      message: item.info.name,
      preferBelow: false,
      waitDuration: const Duration(milliseconds: 300),
      child: InkWell(
        onTap: isSelected
            ? null
            : () {
                final route = PageRouteBuilder(
                  pageBuilder: (_, __, ___) => item.screenBuilder(),
                  transitionDuration: const Duration(milliseconds: 200),
                  transitionsBuilder: (_, animation, __, child) {
                    return FadeTransition(opacity: animation, child: child);
                  },
                );
                // Use push from home, pushReplacement from metric screens
                if (isHome) {
                  Navigator.push(context, route);
                } else {
                  Navigator.pushReplacement(context, route);
                }
              },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12),
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: isSelected
                ? item.info.color.withValues(alpha: 0.15)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: isSelected
                ? Border.all(
                    color: item.info.color.withValues(alpha: 0.3),
                    width: 1,
                  )
                : null,
          ),
          child: Icon(
            item.info.icon,
            size: 22,
            color: isSelected ? item.info.color : colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

/// Small section divider with label.
class _SectionDivider extends StatelessWidget {
  final String label;

  const _SectionDivider({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.grey[500],
              fontWeight: FontWeight.w500,
              fontSize: 10,
            ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
