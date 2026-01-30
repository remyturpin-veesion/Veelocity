import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/providers.dart';
import '../widgets/kpi_card.dart';
import '../widgets/skeleton_card.dart';

/// Linear overview screen: sync status, summary cards, teams, recent issues.
/// Renders content only; AppShell provides the single BaseScaffold (filters bar, sidebar).
class LinearOverviewScreen extends ConsumerWidget {
  const LinearOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(linearOverviewProvider);
    final coverageAsync = ref.watch(syncCoverageProvider);
    final teamsAsync = ref.watch(linearTeamsProvider);
    final issuesAsync =
        ref.watch(linearIssuesProvider(LinearIssuesFilter.none));
    final selectedPeriod = ref.watch(selectedPeriodProvider);

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

          // Sync status (connector name from coverage)
          coverageAsync.when(
            data: (coverage) {
              final linearList = coverage.connectors
                  .where((c) => c.connectorName == 'linear')
                  .toList();
              if (linearList.isEmpty) return const SizedBox.shrink();
              final linearConnector = linearList.first;
              final displayName = (linearConnector.displayName != null &&
                      linearConnector.displayName!.isNotEmpty)
                  ? linearConnector.displayName!
                  : linearConnector.connectorName;
              return Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(
                          Icons.sync,
                          color: linearConnector.isRecent
                              ? Colors.green
                              : Colors.orange,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          displayName,
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Last sync: ${linearConnector.timeSinceSync}',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey[600],
                                  ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),

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
                            'Last ${selectedPeriod.days} days · ${overview.issuesCompletedPerWeek.toStringAsFixed(1)}/week',
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
          const SizedBox(height: 32),

          // Teams (optional)
          teamsAsync.when(
            data: (teams) {
              if (teams.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Teams',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: teams
                        .map((t) => Chip(
                              label: Text('${t.name} (${t.key})'),
                              avatar: const Icon(Icons.group, size: 18),
                            ))
                        .toList(),
                  ),
                  const SizedBox(height: 24),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),

          // Recent issues (optional, first 10)
          issuesAsync.when(
            data: (issues) {
              if (issues.isEmpty) return const SizedBox.shrink();
              final recent = issues.take(10).toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Recent issues',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: recent.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final issue = recent[i];
                        return ListTile(
                          title: Text(
                            '${issue.identifier}: ${issue.title}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(issue.state),
                          trailing: issue.linkedPrId != null
                              ? Icon(Icons.link,
                                  size: 18, color: Colors.grey[600])
                              : null,
                          onTap: issue.linkedPrId != null
                              ? () => context.go('/pr/${issue.linkedPrId}')
                              : null,
                        );
                      },
                    ),
                  ),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
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
