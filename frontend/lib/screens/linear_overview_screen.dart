import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/providers.dart';
import '../widgets/import_by_date_card.dart';
import '../widgets/kpi_card.dart';
import '../widgets/skeleton_card.dart';

/// Linear overview screen: sync status, summary cards, teams.
/// Renders content only; AppShell provides the single BaseScaffold (filters bar, sidebar).
class LinearOverviewScreen extends ConsumerWidget {
  const LinearOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(linearOverviewProvider);
    final coverageAsync = ref.watch(syncCoverageProvider);
    final dateRange = ref.watch(selectedDateRangeProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Linear',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Issues, backlog, and time in state',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),

          // Sync status + Import by date (one card, Import button expands form)
          coverageAsync.when(
            data: (coverage) {
              final linearList = coverage.connectors
                  .where((c) => c.connectorName == 'linear')
                  .toList();
              final syncStatusRow = linearList.isEmpty
                  ? null
                  : () {
                      final c = linearList.first;
                      final displayName =
                          (c.displayName != null && c.displayName!.isNotEmpty)
                              ? c.displayName!
                              : c.connectorName;
                      return Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.sync,
                            color: c.isRecent ? Colors.green : Colors.orange,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            displayName,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Last sync: ${c.timeSinceSync}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: Colors.grey[600]),
                          ),
                        ],
                      );
                    }();
              return ImportByDateCard(
                syncStatusRow: syncStatusRow,
                initialConnector: ImportConnector.linear,
                onImportComplete: () {
                  ref.invalidate(syncCoverageProvider);
                  ref.invalidate(linearOverviewProvider);
                  ref.invalidate(linearTeamsProvider);
                  ref.invalidate(linearIssuesProvider(
                      ref.read(linearIssuesFilterProvider)));
                },
              );
            },
            loading: () => const ImportByDateCard(
              initialConnector: ImportConnector.linear,
            ),
            error: (_, __) => const ImportByDateCard(
              initialConnector: ImportConnector.linear,
            ),
          ),
          const SizedBox(height: 24),

          // Summary cards (overview)
          overviewAsync.when(
            loading: () => const Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(width: 280, child: KPISkeletonCard()),
                SizedBox(width: 280, child: KPISkeletonCard()),
                SizedBox(width: 280, child: KPISkeletonCard()),
              ],
            ),
            error: (e, _) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Failed to load Linear overview: $e'),
              ),
            ),
            data: (overview) => LayoutBuilder(
              builder: (context, constraints) {
                final isWide = constraints.maxWidth > 600;
                final cardWidth = isWide
                    ? (constraints.maxWidth - 32) / 3
                    : constraints.maxWidth;
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Issues completed',
                        value: '${overview.issuesCompleted}',
                        subtitle:
                            '${dateRange.summaryLabel} · ${overview.issuesCompletedPerWeek.toStringAsFixed(1)}/week',
                        icon: Icons.check_circle_outline,
                        color: Colors.teal,
                        onTap: () =>
                            context.go('/metrics/linear/issues-completed'),
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Backlog',
                        value: '${overview.backlogCount}',
                        subtitle: 'open issues',
                        icon: Icons.inbox,
                        color: Colors.orange,
                        onTap: () => context.go('/metrics/linear/backlog'),
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: KPICard(
                        title: 'Time in state',
                        value:
                            _formatDuration(overview.timeInStateAverageHours),
                        subtitle:
                            '${overview.timeInStateCount} issues · median ${_formatDuration(overview.timeInStateMedianHours)}',
                        icon: Icons.schedule,
                        color: Colors.deepPurple,
                        onTap: () =>
                            context.go('/metrics/linear/time-in-state'),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(double hours) {
    if (hours == 0) return 'N/A';
    if (hours < 1) return '${(hours * 60).round()}m';
    if (hours < 24) return '${hours.toStringAsFixed(1)}h';
    return '${(hours / 24).toStringAsFixed(1)}d';
  }
}
