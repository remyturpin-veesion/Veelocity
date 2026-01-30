import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/developer.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/base_scaffold.dart';
import '../../widgets/breadcrumb.dart';
import '../../widgets/repo_selector.dart';

/// Base screen for displaying metric details.
///
/// Provides a consistent layout with:
/// - BaseScaffold with navigation tabs and filters
/// - Info section with description and calculation
/// - Summary stats section (aggregated for all selected repos/developers)
/// - Multi-repo/developer chart section (unified chart with one line per entity)
/// - Bottom content section (e.g., measurements table)
///
/// In Dashboard mode, displays repository-based charts.
/// In Team mode, displays developer-based charts.
class MetricDetailScreen extends ConsumerWidget {
  final MetricInfo metricInfo;
  final Widget Function(BuildContext context, WidgetRef ref) summaryBuilder;
  final Widget Function(BuildContext context, WidgetRef ref) contentBuilder;

  /// Builder for the unified multi-repo chart section (Dashboard mode).
  /// Receives the list of selected repos to display.
  final Widget Function(
          BuildContext context, WidgetRef ref, List<RepoOption> repos)?
      multiRepoChartBuilder;

  /// Builder for the unified multi-developer chart section (Team mode).
  /// Receives the list of selected developers to display.
  final Widget Function(
          BuildContext context, WidgetRef ref, List<Developer> developers)?
      multiDeveloperChartBuilder;

  final Widget Function(BuildContext context, WidgetRef ref)?
      bottomContentBuilder;
  final VoidCallback? onRefresh;

  const MetricDetailScreen({
    super.key,
    required this.metricInfo,
    required this.summaryBuilder,
    required this.contentBuilder,
    this.multiRepoChartBuilder,
    this.multiDeveloperChartBuilder,
    this.bottomContentBuilder,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTab = ref.watch(mainTabProvider);
    final isTeamMode = currentTab == MainTab.team;

    final selectedRepoIds = ref.watch(selectedRepoIdsProvider);
    final selectedDeveloperLogins = ref.watch(selectedDeveloperLoginsProvider);
    final reposAsync = ref.watch(repositoriesProvider);
    final developersAsync = ref.watch(developersProvider);

    return BaseScaffold(
      currentMetricId: metricInfo.id,
      isHome: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Breadcrumb(
              label: _isLinearMetric(metricInfo.id) ? 'Linear' : 'GitHub',
              route: _isLinearMetric(metricInfo.id)
                  ? '/linear?tab=linear'
                  : '/github?tab=github',
            ),
            const SizedBox(height: 16),
            // Title Section with info button
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: metricInfo.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    metricInfo.icon,
                    color: metricInfo.color,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            metricInfo.name,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                          const SizedBox(width: 8),
                          IconButton(
                            icon: Icon(Icons.info_outline,
                                color: metricInfo.color),
                            onPressed: () =>
                                _showMetricInfoDialog(context, metricInfo),
                            tooltip: 'About this metric',
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            iconSize: 20,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        metricInfo.unit,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey[600],
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Summary Stats (aggregated for all selected repos/developers)
            _SectionHeader(
              title: 'Overall Summary',
              subtitle: isTeamMode
                  ? _getDeveloperSelectionLabel(
                      selectedDeveloperLogins, developersAsync)
                  : _getSelectionLabel(selectedRepoIds, reposAsync),
            ),
            const SizedBox(height: 12),
            summaryBuilder(context, ref),
            const SizedBox(height: 16),

            // Aggregated content (chart, table)
            contentBuilder(context, ref),
            const SizedBox(height: 32),

            // Multi-entity chart section (repos in Dashboard mode, developers in Team mode)
            if (isTeamMode && multiDeveloperChartBuilder != null)
              developersAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (response) {
                  final devsToShow = selectedDeveloperLogins.isEmpty
                      ? response.developers
                      : response.developers
                          .where(
                              (d) => selectedDeveloperLogins.contains(d.login))
                          .toList();

                  if (devsToShow.isEmpty) {
                    return const SizedBox.shrink();
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionHeader(
                        title: 'By Developer',
                        subtitle: '${devsToShow.length} developers',
                      ),
                      const SizedBox(height: 16),
                      Card(
                        elevation: 1,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: multiDeveloperChartBuilder!(
                            context,
                            ref,
                            devsToShow,
                          ),
                        ),
                      ),
                    ],
                  );
                },
              )
            else if (!isTeamMode && multiRepoChartBuilder != null)
              reposAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (repos) {
                  final reposToShow = selectedRepoIds.isEmpty
                      ? repos
                      : repos
                          .where((r) => selectedRepoIds.contains(r.id))
                          .toList();

                  if (reposToShow.isEmpty) {
                    return const SizedBox.shrink();
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionHeader(
                        title: 'By Repository',
                        subtitle: '${reposToShow.length} repositories',
                      ),
                      const SizedBox(height: 16),
                      Card(
                        elevation: 1,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: multiRepoChartBuilder!(
                            context,
                            ref,
                            reposToShow,
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),

            // Bottom content section (e.g., measurements table)
            if (bottomContentBuilder != null) ...[
              const SizedBox(height: 8),
              bottomContentBuilder!(context, ref),
            ],
          ],
        ),
      ),
    );
  }

  String _getDeveloperSelectionLabel(
      Set<String> selectedLogins, AsyncValue<DevelopersResponse> devsAsync) {
    return devsAsync.when(
      loading: () => 'Loading...',
      error: (_, __) => 'Error loading developers',
      data: (response) {
        if (selectedLogins.isEmpty ||
            selectedLogins.length == response.developers.length) {
          return 'All developers';
        } else if (selectedLogins.length == 1) {
          return selectedLogins.first;
        } else {
          return '${selectedLogins.length} developers selected';
        }
      },
    );
  }

  String _getSelectionLabel(
      Set<int> selectedIds, AsyncValue<List<RepoOption>> reposAsync) {
    return reposAsync.when(
      loading: () => 'Loading...',
      error: (_, __) => 'Error loading repos',
      data: (repos) {
        if (selectedIds.isEmpty || selectedIds.length == repos.length) {
          return 'All repositories';
        } else if (selectedIds.length == 1) {
          final repo = repos.firstWhere((r) => r.id == selectedIds.first);
          return repo.name;
        } else {
          return '${selectedIds.length} repositories selected';
        }
      },
    );
  }
}

bool _isLinearMetric(String metricId) {
  return metricId == 'linear_issues_completed' ||
      metricId == 'linear_backlog' ||
      metricId == 'linear_time_in_state';
}

/// Show a dialog with metric information.
void _showMetricInfoDialog(BuildContext context, MetricInfo metricInfo) {
  final isDark = Theme.of(context).brightness == Brightness.dark;

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: isDark
          ? const Color(0xFF1E1E1E)
          : Theme.of(context).dialogBackgroundColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: metricInfo.color.withValues(alpha: isDark ? 0.2 : 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              metricInfo.icon,
              color: metricInfo.color,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'About ${metricInfo.name}',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _InfoSection(
              title: 'What it measures',
              content: metricInfo.description,
              icon: Icons.info_outline,
              isDark: isDark,
            ),
            const SizedBox(height: 20),
            _InfoSection(
              title: 'How it\'s calculated',
              content: metricInfo.calculation,
              icon: Icons.calculate_outlined,
              isDark: isDark,
            ),
            const SizedBox(height: 20),
            _TipsSection(tips: metricInfo.tips, isDark: isDark),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          style: TextButton.styleFrom(
            foregroundColor: metricInfo.color,
          ),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

/// Section header with title and subtitle.
class _SectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
        ),
      ],
    );
  }
}

class _InfoSection extends StatelessWidget {
  final String title;
  final String content;
  final IconData icon;
  final bool isDark;

  const _InfoSection({
    required this.title,
    required this.content,
    required this.icon,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              icon,
              size: 18,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          content,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: isDark ? Colors.grey[300] : Colors.grey[800],
                height: 1.6,
              ),
        ),
      ],
    );
  }
}

class _TipsSection extends StatelessWidget {
  final List<String> tips;
  final bool isDark;

  const _TipsSection({required this.tips, this.isDark = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.lightbulb_outline,
              size: 18,
              color: isDark ? Colors.amber[400] : Colors.amber[700],
            ),
            const SizedBox(width: 8),
            Text(
              'Tips for improvement',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...tips.map((tip) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '• ',
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 16,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      tip,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: isDark ? Colors.grey[300] : Colors.grey[800],
                            height: 1.6,
                          ),
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }
}

/// A card widget for displaying a summary stat.
class SummaryStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData? icon;
  final Color? color;

  const SummaryStatCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 20, color: color ?? Colors.grey[600]),
              const SizedBox(height: 8),
            ],
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: color ?? Theme.of(context).primaryColor,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
