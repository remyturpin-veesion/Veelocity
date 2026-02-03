import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/developer.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/empty_state.dart';

/// Full-page developer performance profile (Phase 3 - Feature 10).
class DeveloperProfileScreen extends ConsumerWidget {
  final String login;

  const DeveloperProfileScreen({super.key, required this.login});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(developerStatsProvider(login));
    final developersAsync = ref.watch(developersProvider);

    // Resolve avatar from developers list if available
    Developer? developer;
    for (final d in developersAsync.valueOrNull?.developers ?? []) {
      if (d.login == login) {
        developer = d;
        break;
      }
    }

    return BaseScaffold(
      isHome: false,
      showFilters: true,
      child: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorEmptyState(
          message: 'Failed to load profile for $login.\n$error',
          onRetry: () => ref.invalidate(developerStatsProvider(login)),
        ),
        data: (stats) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Breadcrumb(label: 'Team', route: '/team'),
              const SizedBox(height: 16),
              _buildHeader(context, login, developer?.avatar),
              const SizedBox(height: 24),
              _buildSection(
                context,
                'Pull requests',
                [
                  _StatRow('PRs created', stats.prsCreated.toString()),
                  _StatRow('PRs merged', stats.prsMerged.toString()),
                  _StatRow('PRs open', stats.prsOpen.toString()),
                  _StatRow('Avg merge time', _formatHours(stats.avgMergeHours)),
                ],
              ),
              const SizedBox(height: 24),
              _buildSection(
                context,
                'Code changes',
                [
                  _StatRow('Lines added', '+${stats.totalAdditions}'),
                  _StatRow('Lines deleted', '-${stats.totalDeletions}'),
                  _StatRow('Total lines', '${stats.totalLines}'),
                  _StatRow(
                      'Avg lines/PR', stats.avgLinesPerPr.toStringAsFixed(0)),
                ],
              ),
              const SizedBox(height: 24),
              _buildSection(
                context,
                'Collaboration',
                [
                  _StatRow('Reviews given', stats.reviewsGiven.toString()),
                  _StatRow('Comments made', stats.commentsMade.toString()),
                  _StatRow('Commits made', stats.commitsMade.toString()),
                ],
              ),
              const SizedBox(height: 24),
              _buildLinearSection(context, ref, login),
              const SizedBox(height: 24),
              _buildLinearIssuesCompletedSection(context, ref, login),
              const SizedBox(height: 24),
              _buildLinearTimeInStateSection(context, ref, login),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLinearSection(
      BuildContext context, WidgetRef ref, String login) {
    final linearAsync = ref.watch(linearOverviewForDeveloperProvider(login));
    return linearAsync.when(
      data: (overview) => _buildSection(
        context,
        'Linear',
        [
          _StatRow('Issues completed', overview.issuesCompleted.toString()),
          _StatRow(
              'Per week', overview.issuesCompletedPerWeek.toStringAsFixed(1)),
          _StatRow('Backlog', overview.backlogCount.toString()),
          _StatRow(
            'Avg time in state',
            overview.timeInStateCount > 0
                ? _formatHours(overview.timeInStateAverageHours)
                : 'N/A',
          ),
          _StatRow(
            'Median time in state',
            overview.timeInStateCount > 0
                ? _formatHours(overview.timeInStateMedianHours)
                : 'N/A',
          ),
        ],
      ),
      loading: () => Card(
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (e, _) => _buildSection(
        context,
        'Linear',
        [
          _StatRow('—', 'No Linear data for this assignee'),
        ],
      ),
    );
  }

  Widget _buildLinearIssuesCompletedSection(
      BuildContext context, WidgetRef ref, String login) {
    final theme = Theme.of(context);
    final async = ref.watch(linearIssuesCompletedForDeveloperProvider(login));
    return async.when(
      data: (data) {
        final rows = data.data.isEmpty
            ? <Widget>[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No issues completed in period',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ]
            : data.data
                .map(
                  (d) => _StatRow(
                    _formatPeriodLabel(d.period),
                    '${d.count}',
                  ),
                )
                .toList();
        return _buildSection(
          context,
          'Linear issues completed',
          [
            _StatRow('Total', data.total.toString()),
            _StatRow('Avg per period', data.average.toStringAsFixed(1)),
            const SizedBox(height: 8),
            ...rows,
          ],
        );
      },
      loading: () => Card(
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (_, __) => _buildSection(
        context,
        'Linear issues completed',
        [_StatRow('—', 'Unavailable')],
      ),
    );
  }

  Widget _buildLinearTimeInStateSection(
      BuildContext context, WidgetRef ref, String login) {
    final async = ref.watch(linearTimeInStateForDeveloperProvider(login));
    return async.when(
      data: (data) {
        final stageRows = data.stages
            .where((s) => s.count > 0)
            .map(
              (s) => _StatRow(
                s.label,
                '${s.count} · ${_formatHours(s.averageHours)} avg',
              ),
            )
            .toList();
        final rows = <Widget>[
          _StatRow('Issues completed (in period)', data.count.toString()),
          _StatRow('Avg time in state', _formatHours(data.averageHours)),
          _StatRow('Median', _formatHours(data.medianHours)),
          if (stageRows.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...stageRows,
          ],
        ];
        return _buildSection(context, 'Linear time in state', rows);
      },
      loading: () => Card(
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (_, __) => _buildSection(
        context,
        'Linear time in state',
        [_StatRow('—', 'Unavailable')],
      ),
    );
  }

  static String _formatPeriodLabel(String period) {
    if (period.contains('-W')) {
      final parts = period.split('-W');
      if (parts.length == 2) return 'Week ${parts[1]}, ${parts[0]}';
    }
    return period;
  }

  Widget _buildHeader(BuildContext context, String login, String? avatarUrl) {
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            CircleAvatar(
              radius: 40,
              backgroundImage:
                  avatarUrl != null ? NetworkImage(avatarUrl) : null,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: avatarUrl == null
                  ? Text(
                      login.isNotEmpty ? login[0].toUpperCase() : '?',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.bold,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    login,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Developer performance profile',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(
    BuildContext context,
    String title,
    List<Widget> rows,
  ) {
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ...rows,
          ],
        ),
      ),
    );
  }

  static String _formatHours(double hours) {
    if (hours == 0) return 'N/A';
    if (hours < 1) return '${(hours * 60).round()} min';
    if (hours < 24) return '${hours.toStringAsFixed(1)} hrs';
    return '${(hours / 24).toStringAsFixed(1)} days';
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;

  const _StatRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyLarge,
          ),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
