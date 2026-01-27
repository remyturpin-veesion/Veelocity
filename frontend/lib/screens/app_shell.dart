import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import 'dashboard_screen.dart';
import 'team_screen.dart';

/// Main app shell that displays Dashboard or Team based on the current tab.
class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTab = ref.watch(mainTabProvider);

    return BaseScaffold(
      isHome: true,
      child: IndexedStack(
        index: currentTab == MainTab.dashboard ? 0 : 1,
        children: const [
          DashboardScreen(),
          TeamScreen(),
        ],
      ),
    );
  }
}
