import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/development_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart' show formatDuration;
import '../../widgets/repo_comparison_chart.dart';
import '../../widgets/repo_selector.dart';
import 'metric_detail_screen.dart';

/// Predefined colors for repository bars.
const _repoColors = [
  Colors.teal,
  Colors.blue,
  Colors.purple,
  Colors.green,
  Colors.pink,
  Colors.indigo,
  Colors.amber,
  Colors.cyan,
  Colors.red,
  Colors.lime,
];

/// Detail screen for PR Review Time metric.
class PRReviewTimeScreen extends ConsumerWidget {
  const PRReviewTimeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(prReviewTimeProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.prReviewTime,
      onRefresh: () {
        ref.invalidate(prReviewTimeProvider);
        final repos = ref.read(repositoriesProvider).valueOrNull ?? [];
        for (final repo in repos) {
          ref.invalidate(prReviewTimeByRepoProvider(repo.id));
        }
      },
      summaryBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => _buildLoadingSummary(),
          error: (e, _) => _buildErrorSummary(context, e),
          data: (data) => _buildSummary(context, data),
        );
      },
      contentBuilder: (context, ref) {
        // No separate overall chart - included in comparison chart
        return const SizedBox.shrink();
      },
      multiRepoChartBuilder: (context, ref, repos) {
        return _MultiRepoComparisonSection(repos: repos);
      },
    );
  }

  Widget _buildLoadingSummary() {
    return const Row(
      children: [
        Expanded(child: _SkeletonStatCard()),
        SizedBox(width: 12),
        Expanded(child: _SkeletonStatCard()),
        SizedBox(width: 12),
        Expanded(child: _SkeletonStatCard()),
      ],
    );
  }

  Widget _buildErrorSummary(BuildContext context, Object error) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Failed to load: $error'),
      ),
    );
  }

  Widget _buildSummary(BuildContext context, PRReviewTime data) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 500;
        final cardWidth = isWide
            ? (constraints.maxWidth - 24) / 3
            : (constraints.maxWidth - 12) / 2;

        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Average',
                value: formatDuration(data.averageHours),
                icon: Icons.access_time,
                color: Colors.orange,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Median',
                value: formatDuration(data.medianHours),
                icon: Icons.analytics_outlined,
                color: Colors.orange,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'PRs reviewed',
                value: '${data.count}',
                icon: Icons.rate_review,
                color: Colors.orange,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SkeletonStatCard extends StatelessWidget {
  const _SkeletonStatCard();

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
            Container(
              width: 60,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              width: 80,
              height: 16,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Multi-repo comparison chart section that includes overall data.
class _MultiRepoComparisonSection extends ConsumerWidget {
  final List<RepoOption> repos;

  const _MultiRepoComparisonSection({required this.repos});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overallAsync = ref.watch(prReviewTimeProvider);
    final dataList = <RepoComparisonData>[];
    bool isLoading = false;
    String? errorMessage;

    // Add overall data as first bar
    overallAsync.when(
      loading: () => isLoading = true,
      error: (e, _) => errorMessage ??= e.toString(),
      data: (data) {
        if (data.count > 0) {
          dataList.add(RepoComparisonData(
            repoId: 0,
            repoName: 'All Repositories',
            value: data.averageHours,
            color: Colors.orange,
            formattedValue: formatDuration(data.averageHours),
          ));
        }
      },
    );

    // Add per-repo data
    for (var i = 0; i < repos.length; i++) {
      final repo = repos[i];
      final dataAsync = ref.watch(prReviewTimeByRepoProvider(repo.id));

      dataAsync.when(
        loading: () => isLoading = true,
        error: (e, _) => errorMessage ??= e.toString(),
        data: (data) {
          if (data.count > 0) {
            dataList.add(RepoComparisonData(
              repoId: repo.id!,
              repoName: repo.name,
              value: data.averageHours,
              color: _repoColors[i % _repoColors.length],
              formattedValue: formatDuration(data.averageHours),
            ));
          }
        },
      );
    }

    if (isLoading && dataList.isEmpty) {
      return const SizedBox(
        height: 200,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (errorMessage != null && dataList.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Error: $errorMessage',
            style: TextStyle(color: Colors.red[400])),
      );
    }

    if (dataList.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No PR review time data available'),
      );
    }

    return RepoComparisonChart(
      data: dataList,
      title: 'Average PR Review Time',
      valueLabel: 'Hours',
      valueFormatter: (value) => formatDuration(value),
    );
  }
}
