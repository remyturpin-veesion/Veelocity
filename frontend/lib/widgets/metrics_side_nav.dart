import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/metric_info.dart';
import '../services/providers.dart';

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

  /// Whether we're on the home screen for the current section.
  final bool isHome;

  /// Current main tab; determines which sidebar items to show (GitHub vs Linear). When null, show all (legacy).
  final MainTab? currentTab;

  /// Callback when home is tapped (used when navigating from metric screens).
  final VoidCallback? onHomeTap;

  /// Width of the navigation rail.
  final double width;

  const MetricsSideNav({
    super.key,
    this.currentMetricId,
    this.isHome = false,
    this.currentTab,
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
      info: MetricInfo.linearIssuesCompleted,
      route: '/metrics/linear/issues-completed',
    ),
    const _MetricNavItem(
      info: MetricInfo.linearBacklog,
      route: '/metrics/linear/backlog',
    ),
    const _MetricNavItem(
      info: MetricInfo.linearTimeInState,
      route: '/metrics/linear/time-in-state',
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
    const _MetricNavItem(
      info: MetricInfo.correlations,
      route: '/insights/correlations',
    ),
  ];

  /// GitHub-only items: DORA (0-1), Dev (2-5), Insights (9-12). Indices in _items.
  static final List<_MetricNavItem> _githubItems = [
    ..._items.take(2),
    ..._items.skip(2).take(4),
    ..._items.skip(9).take(4),
  ];

  /// Linear-only items: issues completed, backlog, time in state. Indices 6-8 in _items.
  static final List<_MetricNavItem> _linearItems =
      _items.skip(6).take(3).toList();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // Dashboard, Data, and Alerts tabs at home: no sidebar (aggregated view)
    if ((currentTab == MainTab.dashboard ||
            currentTab == MainTab.dataCoverage ||
            currentTab == MainTab.alerts) &&
        isHome) {
      return const SizedBox.shrink();
    }

    final bool isGitHubSection =
        currentTab == MainTab.github || currentTab == MainTab.team;
    final bool isLinearSection = currentTab == MainTab.linear;
    final List<_MetricNavItem> items = isLinearSection
        ? _linearItems
        : isGitHubSection
            ? _githubItems
            : _items;

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
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 8),
                _buildHomeItem(context, colorScheme),
                const SizedBox(height: 8),
                const Divider(height: 1, indent: 8, endIndent: 8),
                const SizedBox(height: 8),
                if (isLinearSection) ...[
                  ...items.map((item) => _buildNavItem(context, item)),
                ] else if (isGitHubSection) ...[
                  const _SectionDivider(label: 'DORA'),
                  ...items.take(2).map((item) => _buildNavItem(context, item)),
                  const SizedBox(height: 8),
                  const _SectionDivider(label: 'Dev'),
                  ...items
                      .skip(2)
                      .take(4)
                      .map((item) => _buildNavItem(context, item)),
                  const SizedBox(height: 8),
                  const _SectionDivider(label: 'Insights'),
                  ...items.skip(6).map((item) => _buildNavItem(context, item)),
                ] else ...[
                  const _SectionDivider(label: 'DORA'),
                  ..._items.take(2).map((item) => _buildNavItem(context, item)),
                  const SizedBox(height: 8),
                  const _SectionDivider(label: 'Dev'),
                  ..._items
                      .skip(2)
                      .take(4)
                      .map((item) => _buildNavItem(context, item)),
                  const SizedBox(height: 8),
                  const _SectionDivider(label: 'Insights'),
                  ..._items.skip(6).map((item) => _buildNavItem(context, item)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeItem(BuildContext context, ColorScheme colorScheme) {
    final String homeTooltip = currentTab == MainTab.team
        ? 'Team'
        : currentTab == MainTab.github
            ? 'GitHub'
            : currentTab == MainTab.dataCoverage
                ? 'Data'
                : currentTab == MainTab.alerts
                    ? 'Alerts'
                    : currentTab == MainTab.linear
                        ? 'Linear'
                        : 'Dashboard';
    final String homeRoute = currentTab == MainTab.team
        ? '/team?tab=team'
        : currentTab == MainTab.github
            ? '/github?tab=github'
            : currentTab == MainTab.dataCoverage
                ? '/data-coverage?tab=dataCoverage'
                : currentTab == MainTab.alerts
                    ? '/alerts?tab=alerts'
                    : currentTab == MainTab.linear
                        ? '/linear?tab=linear'
                        : '/?tab=dashboard';

    return Tooltip(
      message: homeTooltip,
      preferBelow: false,
      waitDuration: const Duration(milliseconds: 300),
      child: InkWell(
        onTap: isHome
            ? null
            : () {
                if (onHomeTap != null) {
                  onHomeTap!();
                } else {
                  context.go(homeRoute);
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
