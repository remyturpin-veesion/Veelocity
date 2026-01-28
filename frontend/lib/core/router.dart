import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../screens/app_shell.dart';
import '../screens/data_coverage_screen.dart';
import '../screens/metrics/cycle_time_screen.dart';
import '../screens/metrics/deployment_frequency_screen.dart';
import '../screens/metrics/lead_time_screen.dart';
import '../screens/metrics/pr_merge_time_screen.dart';
import '../screens/metrics/pr_review_time_screen.dart';
import '../screens/metrics/throughput_screen.dart';
import '../services/providers.dart';

/// GoRouter configuration for the app.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/?tab=dashboard',
    routes: [
      ShellRoute(
        builder: (context, state, child) {
          // Sync mainTabProvider with URL based on query parameter
          final path = state.uri.path;
          final tab = state.uri.queryParameters['tab'];
          
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (tab == 'team' || path.startsWith('/team')) {
              ref.read(mainTabProvider.notifier).state = MainTab.team;
            } else {
              // Default to dashboard for all other cases
              ref.read(mainTabProvider.notifier).state = MainTab.dashboard;
            }
          });
          
          return child;
        },
        routes: [
          // Dashboard (home)
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const AppShell(),
            ),
          ),
          GoRoute(
            path: '/dashboard',
            redirect: (context, state) => '/?tab=dashboard',
          ),
          // Team
          GoRoute(
            path: '/team',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const AppShell(),
            ),
          ),
          // Metric detail screens
          GoRoute(
            path: '/metrics/deployment-frequency',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const DeploymentFrequencyScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/lead-time',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const LeadTimeScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/pr-review-time',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const PRReviewTimeScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/pr-merge-time',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const PRMergeTimeScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/cycle-time',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const CycleTimeScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/throughput',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const ThroughputScreen(),
            ),
          ),
          // Data coverage
          GoRoute(
            path: '/data-coverage',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const DataCoverageScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});

/// Build a page with fade transition.
CustomTransitionPage _buildFadePage(GoRouterState state, Widget child) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 200),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(opacity: animation, child: child);
    },
  );
}
