import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/providers.dart';
import '../services/theme_provider.dart';
import 'dashboard_customize_dialog.dart';
import 'developer_multi_selector.dart';
import 'metrics_side_nav.dart';
import 'period_selector.dart';
import 'repo_multi_selector.dart';

/// Base scaffold providing consistent layout across all screens.
///
/// Includes:
/// - Optional global filters bar (Dashboard/Team tabs, period selector, dark mode)
/// - MetricsSideNav on the left
/// - Main content area
class BaseScaffold extends ConsumerWidget {
  /// Current metric ID for the side nav (null if on home/dashboard).
  final String? currentMetricId;

  /// Whether we're on the home/dashboard screen (main Dashboard or Team).
  final bool isHome;

  /// Whether to show the filters bar (period and repo selectors).
  final bool showFilters;

  /// Child widget to display in the main content area.
  final Widget child;

  const BaseScaffold({
    super.key,
    this.currentMetricId,
    this.isHome = false,
    this.showFilters = true,
    required this.child,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final selectedRepoIds = ref.watch(selectedRepoIdsProvider);
    final selectedDeveloperLogins = ref.watch(selectedDeveloperLoginsProvider);
    final reposAsync = ref.watch(repositoriesProvider);
    final developersAsync = ref.watch(developersProvider);
    final currentTab = ref.watch(mainTabProvider);

    return Scaffold(
      body: Row(
        children: [
          // Metrics navigation sidebar (hidden on Dashboard home; contextual for GitHub/Linear)
          MetricsSideNav(
            currentMetricId: currentMetricId,
            isHome: isHome,
            currentTab: currentTab,
          ),
          // Main content
          Expanded(
            child: Column(
              children: [
                // Period selector bar
                if (showFilters)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.grey.withValues(alpha: 0.2),
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        // Navigation tabs
                        _NavigationTabs(
                          currentTab: currentTab,
                          isHome: isHome,
                        ),
                        const Spacer(),
                        PeriodSelector(
                          selected: selectedPeriod,
                          onChanged: (period) {
                            ref.read(selectedPeriodProvider.notifier).state =
                                period;
                          },
                        ),
                        const SizedBox(width: 8),
                        _ExportReportButton(
                          startDate: selectedPeriod.startDate,
                          endDate: selectedPeriod.endDate,
                          repoId: selectedRepoIds.length == 1
                              ? selectedRepoIds.first
                              : null,
                        ),
                        if (isHome && currentTab == MainTab.dashboard)
                          IconButton(
                            icon: const Icon(Icons.dashboard_customize),
                            tooltip: 'Customize dashboard',
                            onPressed: () =>
                                DashboardCustomizeDialog.show(context),
                          ),
                        const _ThemeModeButton(),
                      ],
                    ),
                  ),
                // Entity selector section (repos or developers)
                if (showFilters)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest
                          .withValues(alpha: 0.3),
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.grey.withValues(alpha: 0.2),
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              currentTab == MainTab.dashboard ||
                                      currentTab == MainTab.github
                                  ? Icons.folder_outlined
                                  : currentTab == MainTab.team
                                      ? Icons.people_outline
                                      : currentTab == MainTab.alerts
                                          ? Icons.notifications_active
                                          : Icons.inbox,
                              size: 16,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.7),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              currentTab == MainTab.dashboard ||
                                      currentTab == MainTab.github
                                  ? 'Repositories'
                                  : currentTab == MainTab.team
                                      ? 'Developers'
                                      : currentTab == MainTab.alerts
                                          ? 'Alerts'
                                          : 'Linear',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelLarge
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurface
                                        .withValues(alpha: 0.7),
                                  ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Show repo selector in Dashboard and GitHub, developer selector in Team, none for Linear
                        if (currentTab == MainTab.dashboard ||
                            currentTab == MainTab.github)
                          reposAsync.when(
                            loading: () => const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            error: (_, __) => const Text(
                              'Error loading repositories',
                              style: TextStyle(color: Colors.red),
                            ),
                            data: (repos) => RepoMultiSelector(
                              repos: repos,
                              selectedRepoIds: selectedRepoIds,
                              onChanged: (ids) {
                                ref
                                    .read(selectedRepoIdsProvider.notifier)
                                    .state = ids;
                              },
                            ),
                          )
                        else if (currentTab == MainTab.team)
                          developersAsync.when(
                            loading: () => const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            error: (_, __) => const Text(
                              'Error loading developers',
                              style: TextStyle(color: Colors.red),
                            ),
                            data: (response) => DeveloperMultiSelector(
                              developers: response.developers,
                              selectedLogins: selectedDeveloperLogins,
                              onChanged: (logins) {
                                ref
                                    .read(selectedDeveloperLoginsProvider
                                        .notifier)
                                    .state = logins;
                              },
                            ),
                          )
                        else
                          const SizedBox.shrink(),
                      ],
                    ),
                  ),
                // Content
                Expanded(child: child),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Navigation tabs for switching between Dashboard and Team.
class _NavigationTabs extends StatelessWidget {
  final MainTab currentTab;
  final bool isHome;

  const _NavigationTabs({
    required this.currentTab,
    required this.isHome,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildNavTab(
            context,
            icon: Icons.dashboard,
            label: 'Dashboard',
            isSelected: isHome && currentTab == MainTab.dashboard,
            onTap: () => context.go('/?tab=dashboard'),
          ),
          _buildNavTab(
            context,
            icon: Icons.people,
            label: 'Team',
            isSelected: isHome && currentTab == MainTab.team,
            onTap: () => context.go('/team?tab=team'),
          ),
          _buildNavTab(
            context,
            icon: Icons.code,
            label: 'GitHub',
            isSelected: isHome && currentTab == MainTab.github,
            onTap: () => context.go('/github?tab=github'),
          ),
          _buildNavTab(
            context,
            icon: Icons.inbox,
            label: 'Linear',
            isSelected: isHome && currentTab == MainTab.linear,
            onTap: () => context.go('/linear?tab=linear'),
          ),
          _buildNavTab(
            context,
            icon: Icons.notifications_active,
            label: 'Alerts',
            isSelected: isHome && currentTab == MainTab.alerts,
            onTap: () => context.go('/alerts?tab=alerts'),
          ),
        ],
      ),
    );
  }

  Widget _buildNavTab(
    BuildContext context, {
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? colorScheme.primaryContainer : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected
                  ? colorScheme.onPrimaryContainer
                  : colorScheme.onSurface.withValues(alpha: 0.7),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected
                    ? colorScheme.onPrimaryContainer
                    : colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Button to export metrics report as JSON or CSV.
class _ExportReportButton extends ConsumerWidget {
  const _ExportReportButton({
    required this.startDate,
    required this.endDate,
    this.repoId,
  });

  final DateTime startDate;
  final DateTime endDate;
  final int? repoId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiServiceProvider);

    return PopupMenuButton<String>(
      tooltip: 'Export report',
      icon: const Icon(Icons.download),
      onSelected: (value) async {
        final format = value == 'csv' ? ExportFormat.csv : ExportFormat.json;
        final url = api.getExportReportUrl(
          startDate: startDate,
          endDate: endDate,
          repoId: repoId,
          format: format,
        );
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.platformDefault);
        }
      },
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'json',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.code, size: 20),
              SizedBox(width: 8),
              Text('Export as JSON'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'csv',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.table_chart, size: 20),
              SizedBox(width: 8),
              Text('Export as CSV'),
            ],
          ),
        ),
      ],
    );
  }
}

/// Button to toggle between light and dark theme modes.
class _ThemeModeButton extends ConsumerWidget {
  const _ThemeModeButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the provider to rebuild when it changes
    ref.watch(themeModeProvider);
    // Use actual brightness to determine icon (handles system mode correctly)
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return IconButton(
      icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
      tooltip: isDark ? 'Mode clair' : 'Mode sombre',
      onPressed: () {
        // Toggle based on current actual appearance
        final newMode = isDark ? ThemeMode.light : ThemeMode.dark;
        ref.read(themeModeProvider.notifier).setThemeMode(newMode);
      },
    );
  }
}
