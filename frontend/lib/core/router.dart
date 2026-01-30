import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../screens/app_shell.dart';
import '../screens/data_coverage_screen.dart';
import '../screens/developer_profile_screen.dart';
import '../screens/metrics/cycle_time_screen.dart';
import '../screens/metrics/deployment_frequency_screen.dart';
import '../screens/metrics/lead_time_screen.dart';
import '../screens/metrics/linear_backlog_screen.dart';
import '../screens/metrics/linear_issues_completed_screen.dart';
import '../screens/metrics/linear_time_in_state_screen.dart';
import '../screens/metrics/pr_merge_time_screen.dart';
import '../screens/metrics/pr_review_time_screen.dart';
import '../screens/metrics/throughput_screen.dart';
import '../screens/pr_detail_screen.dart';
import '../screens/pr_health_screen.dart';
import '../screens/correlations_screen.dart';
import '../screens/recommendations_screen.dart';
import '../screens/reviewer_workload_screen.dart';
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
            } else if (tab == 'linear' || path.startsWith('/linear')) {
              ref.read(mainTabProvider.notifier).state = MainTab.linear;
            } else {
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
            routes: [
              GoRoute(
                path: 'developer/:login',
                pageBuilder: (context, state) {
                  final login = state.pathParameters['login'] ?? '';
                  return _buildFadePage(
                    state,
                    DeveloperProfileScreen(login: login),
                  );
                },
              ),
            ],
          ),
          // Linear overview (third tab)
          GoRoute(
            path: '/linear',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const AppShell(),
            ),
          ),
          // Linear metric detail screens
          GoRoute(
            path: '/metrics/linear/issues-completed',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const LinearIssuesCompletedScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/linear/backlog',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const LinearBacklogScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/linear/time-in-state',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const LinearTimeInStateScreen(),
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
          GoRoute(
            path: '/metrics/pr-health',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const PRHealthScreen(),
            ),
          ),
          GoRoute(
            path: '/metrics/reviewer-workload',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const ReviewerWorkloadScreen(),
            ),
          ),
          GoRoute(
            path: '/insights/recommendations',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const RecommendationsScreen(),
            ),
          ),
          GoRoute(
            path: '/insights/correlations',
            pageBuilder: (context, state) => _buildFadePage(
              state,
              const CorrelationsScreen(),
            ),
          ),
          GoRoute(
            path: '/pr/:id',
            pageBuilder: (context, state) {
              final idStr = state.pathParameters['id'];
              final prId = idStr != null ? int.tryParse(idStr) : null;
              if (prId == null) {
                return _buildFadePage(
                  state,
                  const Scaffold(
                    body: Center(child: Text('Invalid PR id')),
                  ),
                );
              }
              return _buildFadePage(
                state,
                PRDetailScreen(prId: prId),
              );
            },
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
