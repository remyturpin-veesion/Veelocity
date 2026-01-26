import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/providers.dart';
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

  @override
  Widget build(BuildContext context) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final selectedRepo = ref.watch(selectedRepoProvider);
    final reposAsync = ref.watch(repositoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_currentIndex == 0 ? 'Veelocity Dashboard' : 'Team'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              ref.invalidate(doraMetricsProvider);
              ref.invalidate(developmentMetricsProvider);
              ref.invalidate(developersProvider);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Global filters bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                    ref.read(selectedPeriodProvider.notifier).state = period;
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
                      ref.read(selectedRepoProvider.notifier).state = repo;
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
