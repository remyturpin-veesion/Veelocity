import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/developer.dart';
import '../../models/dora_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart';
import '../../widgets/metric_not_available.dart';
import '../../widgets/multi_repo_trend_chart.dart';
import '../../widgets/repo_selector.dart';
import 'metric_detail_screen.dart';

/// Predefined colors for repository/developer lines.
const _entityColors = [
  Colors.green,
  Colors.orange,
  Colors.purple,
  Colors.teal,
  Colors.pink,
  Colors.indigo,
  Colors.amber,
  Colors.cyan,
  Colors.red,
  Colors.lime,
];

/// Detail screen for Deployment Frequency metric.
class DeploymentFrequencyScreen extends ConsumerWidget {
  const DeploymentFrequencyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(deploymentFrequencyProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.deploymentFrequency,
      onRefresh: () {
        ref.invalidate(deploymentFrequencyProvider);
        final repos = ref.read(repositoriesProvider).valueOrNull ?? [];
        for (final repo in repos) {
          ref.invalidate(deploymentFrequencyByRepoProvider(repo.id));
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
        // No separate overall chart - included in multi-repo chart
        return const SizedBox.shrink();
      },
      multiRepoChartBuilder: (context, ref, repos) {
        return _MultiRepoChartSection(repos: repos);
      },
      multiDeveloperChartBuilder: (context, ref, developers) {
        return _MultiDeveloperChartSection(developers: developers);
      },
      bottomContentBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (data) => _buildMeasurementsTable(context, data),
        );
      },
    );
  }

  Widget _buildLoadingSummary() {
    return const Row(
      children: [
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

  Widget _buildSummary(BuildContext context, DeploymentFrequency data) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 400;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: isWide
                  ? (constraints.maxWidth - 12) / 2
                  : constraints.maxWidth,
              child: SummaryStatCard(
                label: 'Average per week',
                value: '${data.average}',
                icon: Icons.trending_up,
                color: Colors.blue,
              ),
            ),
            SizedBox(
              width: isWide
                  ? (constraints.maxWidth - 12) / 2
                  : constraints.maxWidth,
              child: SummaryStatCard(
                label: 'Total deployments',
                value: '${data.total}',
                icon: Icons.rocket_launch,
                color: Colors.blue,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildMeasurementsTable(
      BuildContext context, DeploymentFrequency data) {
    final measurements = data.data.asMap().entries.map((entry) {
      final d = entry.value;
      final index = entry.key;
      final timestamp = DateTime.now()
          .subtract(Duration(days: (data.data.length - 1 - index) * 7));
      return Measurement(
        id: d.period,
        title: _formatPeriodLabel(d.period),
        value: '${d.count}',
        timestamp: timestamp,
        sortValue: d.count.toDouble(),
        icon: Icons.check_circle_outline,
        color: Colors.green,
      );
    }).toList();

    return MeasurementsTable(
      title: 'Deployments by Period',
      measurements: measurements,
      showTimestamp: false,
      defaultSort: MeasurementSortOption.newestFirst,
    );
  }

  String _formatPeriodLabel(String period) {
    if (period.contains('-W')) {
      final parts = period.split('-W');
      return 'Week ${parts[1]}, ${parts[0]}';
    }
    return period;
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
              width: 100,
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

/// Multi-repo chart section that includes overall data as a series.
class _MultiRepoChartSection extends ConsumerWidget {
  final List<RepoOption> repos;

  const _MultiRepoChartSection({required this.repos});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overallAsync = ref.watch(deploymentFrequencyProvider);
    final seriesList = <RepoTrendSeries>[];
    bool isLoading = false;
    String? errorMessage;

    // Add overall data as first series (blue, dashed style indicated by name)
    overallAsync.when(
      loading: () => isLoading = true,
      error: (e, _) => errorMessage ??= e.toString(),
      data: (data) {
        if (data.data.isNotEmpty) {
          seriesList.add(RepoTrendSeries(
            repoId: 0, // Special ID for overall
            repoName: 'All Repositories',
            data: data.data
                .map((d) =>
                    TrendPoint(period: d.period, value: d.count.toDouble()))
                .toList(),
            color: Colors.blue,
          ));
        }
      },
    );

    // Add per-repo data
    for (var i = 0; i < repos.length; i++) {
      final repo = repos[i];
      final dataAsync = ref.watch(deploymentFrequencyByRepoProvider(repo.id));

      dataAsync.when(
        loading: () => isLoading = true,
        error: (e, _) => errorMessage ??= e.toString(),
        data: (data) {
          if (data.data.isNotEmpty) {
            seriesList.add(RepoTrendSeries(
              repoId: repo.id!,
              repoName: repo.name,
              data: data.data
                  .map((d) =>
                      TrendPoint(period: d.period, value: d.count.toDouble()))
                  .toList(),
              color: _entityColors[i % _entityColors.length],
            ));
          }
        },
      );
    }

    if (isLoading && seriesList.isEmpty) {
      return const SizedBox(
        height: 200,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (errorMessage != null && seriesList.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Error: $errorMessage',
            style: TextStyle(color: Colors.red[400])),
      );
    }

    if (seriesList.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No deployment data available'),
      );
    }

    return MultiRepoTrendChart(
      series: seriesList,
      title: 'Deployments per Period',
      height: 280,
    );
  }
}

/// Multi-developer chart section.
/// Note: Deployment frequency is not available per developer as deployments
/// are team-level events.
class _MultiDeveloperChartSection extends StatelessWidget {
  final List<Developer> developers;

  const _MultiDeveloperChartSection({required this.developers});

  @override
  Widget build(BuildContext context) {
    return const MetricNotAvailable(
      title: 'Metric Not Available Per Developer',
      description:
          'Deployment Frequency measures team-level deployment events and cannot be broken down by individual developers.',
    );
  }
}
