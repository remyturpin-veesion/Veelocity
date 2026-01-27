import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/developer.dart';
import '../services/providers.dart';
import '../widgets/developer_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/skeleton_card.dart';

/// Team screen showing developer statistics.
class TeamScreen extends ConsumerWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final developersAsync = ref.watch(developersProvider);

    return developersAsync.when(
      loading: () => _buildLoadingState(),
      error: (error, _) => _buildErrorState(context, ref, error),
      data: (response) => _buildDevelopersList(context, ref, response),
    );
  }

  Widget _buildLoadingState() {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: SkeletonGrid(count: 6),
    );
  }

  Widget _buildErrorState(BuildContext context, WidgetRef ref, Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Unable to load team data',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => ref.invalidate(developersProvider),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDevelopersList(
    BuildContext context,
    WidgetRef ref,
    DevelopersResponse response,
  ) {
    if (response.developers.isEmpty) {
      return EmptyState.noData();
    }

    final period = ref.watch(selectedPeriodProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${response.count} developers',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Last ${period.days} days',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 600;
              final cardWidth = isWide
                  ? (constraints.maxWidth - 16) / 2
                  : constraints.maxWidth;

              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: response.developers.map((developer) {
                  return SizedBox(
                    width: cardWidth,
                    child: DeveloperCard(
                      developer: developer,
                      onTap: () =>
                          _showDeveloperDetails(context, ref, developer),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showDeveloperDetails(
    BuildContext context,
    WidgetRef ref,
    Developer developer,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DeveloperDetailsSheet(login: developer.login),
    );
  }
}

/// Bottom sheet showing detailed developer stats.
class DeveloperDetailsSheet extends ConsumerWidget {
  final String login;

  const DeveloperDetailsSheet({super.key, required this.login});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(developerStatsProvider(login));

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: statsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => Center(
              child: Text('Error loading stats: $error'),
            ),
            data: (stats) => ListView(
              controller: scrollController,
              children: [
                Row(
                  children: [
                    Text(
                      stats.login,
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _buildStatRow(
                    context, 'PRs Created', stats.prsCreated.toString()),
                _buildStatRow(
                    context, 'PRs Merged', stats.prsMerged.toString()),
                _buildStatRow(context, 'PRs Open', stats.prsOpen.toString()),
                const Divider(height: 32),
                _buildStatRow(
                    context, 'Lines Added', '+${stats.totalAdditions}'),
                _buildStatRow(
                    context, 'Lines Deleted', '-${stats.totalDeletions}'),
                _buildStatRow(
                    context, 'Avg Lines/PR', stats.avgLinesPerPr.toString()),
                _buildStatRow(context, 'Avg Merge Time',
                    _formatHours(stats.avgMergeHours)),
                const Divider(height: 32),
                _buildStatRow(
                    context, 'Reviews Given', stats.reviewsGiven.toString()),
                _buildStatRow(
                    context, 'Comments Made', stats.commentsMade.toString()),
                _buildStatRow(
                    context, 'Commits Made', stats.commitsMade.toString()),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
    );
  }

  String _formatHours(double hours) {
    if (hours == 0) return 'N/A';
    if (hours < 1) return '${(hours * 60).round()} min';
    if (hours < 24) return '${hours.toStringAsFixed(1)} hrs';
    return '${(hours / 24).toStringAsFixed(1)} days';
  }
}
