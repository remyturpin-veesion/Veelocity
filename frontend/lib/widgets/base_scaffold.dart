import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/providers.dart';
import '../services/theme_provider.dart';
import 'developer_multi_selector.dart';
import 'metrics_side_nav.dart';
import 'period_selector.dart';
import 'repo_multi_selector.dart';

/// Base scaffold providing consistent layout across all screens.
///
/// Includes:
/// - AppBar with Dashboard/Team navigation tabs
/// - Theme toggle and refresh buttons
/// - Optional global filters bar (period and repo)
/// - MetricsSideNav on the left
/// - Main content area
class BaseScaffold extends ConsumerWidget {
  /// Current metric ID for the side nav (null if on home/dashboard).
  final String? currentMetricId;

  /// Whether we're on the home/dashboard screen (main Dashboard or Team).
  final bool isHome;

  /// Whether to show the filters bar (period and repo selectors).
  final bool showFilters;

  /// Additional actions for the AppBar.
  final List<Widget>? additionalActions;

  /// Child widget to display in the main content area.
  final Widget child;

  /// Callback when refresh is pressed.
  final VoidCallback? onRefresh;

  const BaseScaffold({
    super.key,
    this.currentMetricId,
    this.isHome = false,
    this.showFilters = true,
    this.additionalActions,
    required this.child,
    this.onRefresh,
  });

  String _formatLastRefresh(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inSeconds < 60) {
      return 'à l\'instant';
    } else if (diff.inMinutes < 60) {
      return 'il y a ${diff.inMinutes} min';
    } else {
      final hours = time.hour.toString().padLeft(2, '0');
      final minutes = time.minute.toString().padLeft(2, '0');
      return '$hours:$minutes';
    }
  }

  void _handleRefresh(WidgetRef ref) {
    ref.invalidate(doraMetricsProvider);
    ref.invalidate(developmentMetricsProvider);
    ref.invalidate(developersProvider);
    ref.invalidate(syncCoverageProvider);
    ref.read(lastRefreshTimeProvider.notifier).state = DateTime.now();
    onRefresh?.call();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final selectedRepoIds = ref.watch(selectedRepoIdsProvider);
    final selectedDeveloperLogins = ref.watch(selectedDeveloperLoginsProvider);
    final reposAsync = ref.watch(repositoriesProvider);
    final developersAsync = ref.watch(developersProvider);
    final lastRefresh = ref.watch(lastRefreshTimeProvider);
    final currentTab = ref.watch(mainTabProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Veelocity'),
        automaticallyImplyLeading: false,
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          // Navigation tabs
          _NavigationTabs(
            currentTab: currentTab,
            isHome: isHome,
            onTabChanged: (tab) {
              ref.read(mainTabProvider.notifier).state = tab;
              // Pop back to home if we're on a detail screen
              if (!isHome) {
                Navigator.of(context).popUntil((route) => route.isFirst);
              }
            },
          ),
          const SizedBox(width: 16),
          if (lastRefresh != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Text(
                  _formatLastRefresh(lastRefresh),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => _handleRefresh(ref),
          ),
          if (additionalActions != null) ...additionalActions!,
          const _ThemeModeButton(),
        ],
      ),
      body: Row(
        children: [
          // Metrics navigation sidebar
          MetricsSideNav(
            currentMetricId: currentMetricId,
            isHome: isHome,
          ),
          // Main content
          Expanded(
            child: Column(
              children: [
                // Global filters bar
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
                        PeriodSelector(
                          selected: selectedPeriod,
                          onChanged: (period) {
                            ref.read(selectedPeriodProvider.notifier).state =
                                period;
                          },
                        ),
                        const SizedBox(width: 16),
                        // Show repo selector in Dashboard mode, developer selector in Team mode
                        if (currentTab == MainTab.dashboard)
                          reposAsync.when(
                            loading: () => const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            error: (_, __) => const SizedBox.shrink(),
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
                        else
                          developersAsync.when(
                            loading: () => const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            error: (_, __) => const SizedBox.shrink(),
                            data: (response) => DeveloperMultiSelector(
                              developers: response.developers,
                              selectedLogins: selectedDeveloperLogins,
                              onChanged: (logins) {
                                ref
                                    .read(
                                        selectedDeveloperLoginsProvider.notifier)
                                    .state = logins;
                              },
                            ),
                          ),
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
  final ValueChanged<MainTab> onTabChanged;

  const _NavigationTabs({
    required this.currentTab,
    required this.isHome,
    required this.onTabChanged,
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
            onTap: () => onTabChanged(MainTab.dashboard),
          ),
          _buildNavTab(
            context,
            icon: Icons.people,
            label: 'Team',
            isSelected: isHome && currentTab == MainTab.team,
            onTap: () => onTabChanged(MainTab.team),
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
