import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/app_colors.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/data_coverage_card.dart';
import '../widgets/data_coverage_section.dart';

/// Screen displaying data coverage by category (GitHub, GitHub Actions, Linear)
/// with a graph of data imported by day and a button to import a specific day.
class DataCoverageScreen extends ConsumerWidget {
  const DataCoverageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coverageAsync = ref.watch(syncCoverageProvider);
    final dailyAsync = ref.watch(dailyCoverageProvider);

    void refresh() {
      ref.invalidate(syncCoverageProvider);
      ref.invalidate(dailyCoverageProvider);
    }

    return BaseScaffold(
      isHome: false,
      showFilters: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Breadcrumb(label: 'Dashboard', route: '/'),
            const SizedBox(height: 16),
            Text(
              'Data Coverage',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Data imported by day per source. Use "Import this day" to backfill a specific date.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            const SizedBox(height: 24),
            // Daily coverage sections (charts + import button per category)
            dailyAsync.when(
              loading: () => const Card(
                child: Padding(
                  padding: EdgeInsets.all(48.0),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
              error: (error, _) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(48.0),
                  child: Column(
                    children: [
                      Icon(Icons.error_outline,
                          size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'Failed to load daily coverage',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        error.toString(),
                        style: TextStyle(color: Colors.grey[600]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: refresh,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (daily) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DataCoverageSection(
                    title: 'GitHub',
                    color: AppColors.github,
                    data: daily.github,
                    connector: CoverageConnector.github,
                    onImportComplete: refresh,
                  ),
                  const SizedBox(height: 16),
                  DataCoverageSection(
                    title: 'GitHub Actions',
                    color: AppColors.deployment,
                    data: daily.githubActions,
                    connector: CoverageConnector.githubActions,
                    onImportComplete: refresh,
                  ),
                  const SizedBox(height: 16),
                  DataCoverageSection(
                    title: 'Linear',
                    color: AppColors.linear,
                    data: daily.linear,
                    connector: CoverageConnector.linear,
                    onImportComplete: refresh,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Summary and repository table
            coverageAsync.when(
              loading: () => const Card(
                child: Padding(
                  padding: EdgeInsets.all(48.0),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
              error: (error, _) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(48.0),
                  child: Column(
                    children: [
                      Icon(Icons.error_outline,
                          size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'Failed to load coverage data',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        error.toString(),
                        style: TextStyle(color: Colors.grey[600]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: refresh,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (coverage) => DataCoverageCard(
                coverage: coverage,
                onRefresh: refresh,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
