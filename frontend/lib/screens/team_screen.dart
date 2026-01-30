import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
      child: Column(
        children: [
          ListItemSkeleton(),
          ListItemSkeleton(),
          ListItemSkeleton(),
          ListItemSkeleton(),
          ListItemSkeleton(),
          ListItemSkeleton(),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, WidgetRef ref, Object error) {
    return ErrorEmptyState(
      title: 'Unable to Load Team Data',
      message: 'We encountered an error while fetching developer statistics.\n'
          'Please try again.',
      onRetry: () => ref.invalidate(developersProvider),
    );
  }

  Widget _buildDevelopersList(
    BuildContext context,
    WidgetRef ref,
    DevelopersResponse response,
  ) {
    if (response.developers.isEmpty) {
      return NoDataEmptyState(
        dataType: 'developers',
        helpText: 'No developers found in the selected time period.\n'
            'Developers will appear once they have activity in GitHub.',
        onRetrySync: () => ref.invalidate(developersProvider),
      );
    }

    final dateRange = ref.watch(selectedDateRangeProvider);

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
            dateRange.summaryLabel,
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
                          context.go('/team/developer/${developer.login}'),
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
}
