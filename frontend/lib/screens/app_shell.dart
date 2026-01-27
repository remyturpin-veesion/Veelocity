import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/providers.dart';
import '../services/theme_provider.dart';
import '../widgets/metrics_side_nav.dart';
import '../widgets/period_selector.dart';
import '../widgets/repo_selector.dart';
import 'dashboard_screen.dart';
import 'team_screen.dart';

/// Main app shell with bottom navigation and global filters.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _currentIndex = 0;

  final _screens = const [
    DashboardScreen(),
    TeamScreen(),
  ];

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

  @override
  Widget build(BuildContext context) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final selectedRepo = ref.watch(selectedRepoProvider);
    final reposAsync = ref.watch(repositoriesProvider);
    final lastRefresh = ref.watch(lastRefreshTimeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_currentIndex == 0 ? 'Veelocity Dashboard' : 'Team'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
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
            onPressed: () {
              ref.invalidate(doraMetricsProvider);
              ref.invalidate(developmentMetricsProvider);
              ref.invalidate(developersProvider);
              ref.invalidate(syncCoverageProvider);
              ref.read(lastRefreshTimeProvider.notifier).state = DateTime.now();
            },
          ),
          _ThemeModeButton(),
        ],
      ),
      body: Row(
        children: [
          // Metrics navigation sidebar
          MetricsSideNav(isHome: _currentIndex == 0),
          // Main content
          Expanded(
            child: Column(
              children: [
                // Global filters bar
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                      reposAsync.when(
                        loading: () => const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        error: (_, __) => const SizedBox.shrink(),
                        data: (repos) => RepoSelector(
                          repos: repos,
                          selected: selectedRepo,
                          onChanged: (repo) {
                            ref.read(selectedRepoProvider.notifier).state =
                                repo;
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                // Content
                Expanded(
                  child: IndexedStack(
                    index: _currentIndex,
                    children: _screens,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outlined),
            selectedIcon: Icon(Icons.people),
            label: 'Team',
          ),
        ],
      ),
    );
  }
}

/// Button to toggle between light and dark theme modes.
class _ThemeModeButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    return IconButton(
      icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
      tooltip: isDark ? 'Mode clair' : 'Mode sombre',
      onPressed: () {
        ref.read(themeModeProvider.notifier).toggle();
      },
    );
  }
}
