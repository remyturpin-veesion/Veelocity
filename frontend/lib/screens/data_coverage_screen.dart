import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/data_coverage_card.dart';
import '../widgets/import_by_date_card.dart';

/// Screen displaying data coverage and sync status.
class DataCoverageScreen extends ConsumerWidget {
  const DataCoverageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coverageAsync = ref.watch(syncCoverageProvider);

    return BaseScaffold(
      isHome: false,
      showFilters: false, // Data coverage doesn't need period/repo filters
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Breadcrumb(label: 'Dashboard', route: '/'),
            const SizedBox(height: 16),
            // Title
            Text(
              'Data Coverage',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Sync status and repository data overview',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            const SizedBox(height: 24),
            // Import by date
            ImportByDateCard(
              onImportComplete: () => ref.invalidate(syncCoverageProvider),
            ),
            const SizedBox(height: 24),
            // Coverage data
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
                    mainAxisAlignment: MainAxisAlignment.center,
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
                        onPressed: () => ref.invalidate(syncCoverageProvider),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (coverage) => DataCoverageCard(
                coverage: coverage,
                onRefresh: () => ref.invalidate(syncCoverageProvider),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
