import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/metric_info.dart';

/// Navigation item for the metrics sidebar.
class _MetricNavItem {
  final MetricInfo info;
  final String route;

  const _MetricNavItem({
    required this.info,
    required this.route,
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
    this.width = 72,
  });

  static final List<_MetricNavItem> _items = [
    const _MetricNavItem(
      info: MetricInfo.deploymentFrequency,
      route: '/metrics/deployment-frequency',
    ),
    const _MetricNavItem(
      info: MetricInfo.leadTime,
      route: '/metrics/lead-time',
    ),
    const _MetricNavItem(
      info: MetricInfo.prReviewTime,
      route: '/metrics/pr-review-time',
    ),
    const _MetricNavItem(
      info: MetricInfo.prMergeTime,
      route: '/metrics/pr-merge-time',
    ),
    const _MetricNavItem(
      info: MetricInfo.cycleTime,
      route: '/metrics/cycle-time',
    ),
    const _MetricNavItem(
      info: MetricInfo.throughput,
      route: '/metrics/throughput',
    ),
    const _MetricNavItem(
      info: MetricInfo.prHealth,
      route: '/metrics/pr-health',
    ),
    const _MetricNavItem(
      info: MetricInfo.reviewerWorkload,
      route: '/metrics/reviewer-workload',
    ),
    const _MetricNavItem(
      info: MetricInfo.recommendations,
      route: '/insights/recommendations',
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
      child: Stack(
        children: [
          // Top navigation items
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
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
                ..._items
                    .skip(2)
                    .take(4)
                    .map((item) => _buildNavItem(context, item)),
                const SizedBox(height: 8),
                // Insights section
                const _SectionDivider(label: 'Insights'),
                ..._items.skip(6).map((item) => _buildNavItem(context, item)),
              ],
            ),
          ),
          // Data Coverage link at bottom
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Divider(height: 1, indent: 8, endIndent: 8),
                const SizedBox(height: 8),
                _buildDataCoverageItem(context),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDataCoverageItem(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Tooltip(
      message: 'Data Coverage',
      preferBelow: false,
      waitDuration: const Duration(milliseconds: 300),
      child: InkWell(
        onTap: () {
          // Preserve tab state when navigating to data coverage
          final currentUri = GoRouterState.of(context).uri;
          final tabParam = currentUri.queryParameters['tab'];
          if (tabParam != null) {
            context.go('/data-coverage?tab=$tabParam');
          } else {
            context.go('/data-coverage?tab=dashboard');
          }
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12),
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.storage,
            size: 22,
            color: colorScheme.onSurfaceVariant,
          ),
        ),
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
                  // Preserve tab state when going home
                  final currentUri = GoRouterState.of(context).uri;
                  final tabParam = currentUri.queryParameters['tab'];
                  if (tabParam == 'team') {
                    context.go('/team?tab=team');
                  } else {
                    context.go('/?tab=dashboard');
                  }
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
                // Preserve tab state in URL
                final currentUri = GoRouterState.of(context).uri;
                final tabParam = currentUri.queryParameters['tab'];
                if (tabParam != null) {
                  context.go('${item.route}?tab=$tabParam');
                } else {
                  context.go(item.route);
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
