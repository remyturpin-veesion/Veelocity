import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/developer.dart';
import '../../models/dora_metrics.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/measurements_table.dart'
    show Measurement, MeasurementSortOption, MeasurementsTable, formatDuration;
import '../../widgets/repo_comparison_chart.dart';
import '../../widgets/repo_selector.dart';
import 'metric_detail_screen.dart';

/// Predefined colors for repository/developer bars.
const _entityColors = [
  Colors.teal,
  Colors.blue,
  Colors.purple,
  Colors.orange,
  Colors.pink,
  Colors.indigo,
  Colors.amber,
  Colors.cyan,
  Colors.red,
  Colors.lime,
];

/// Detail screen for Lead Time for Changes metric.
class LeadTimeScreen extends ConsumerWidget {
  const LeadTimeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricAsync = ref.watch(leadTimeProvider);

    return MetricDetailScreen(
      metricInfo: MetricInfo.leadTime,
      onRefresh: () {
        ref.invalidate(leadTimeProvider);
        final repos = ref.read(repositoriesProvider).valueOrNull ?? [];
        for (final repo in repos) {
          ref.invalidate(leadTimeByRepoProvider(repo.id));
        }
        final devs =
            ref.read(developersProvider).valueOrNull?.developers ?? [];
        for (final dev in devs) {
          ref.invalidate(leadTimeByDeveloperProvider(dev.login));
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
      multiDeveloperChartBuilder: (context, ref, developers) {
        return _MultiDeveloperComparisonSection(developers: developers);
      },
      bottomContentBuilder: (context, ref) {
        return metricAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _buildError(context, e),
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

  Widget _buildSummary(BuildContext context, LeadTimeForChanges data) {
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
                color: Colors.green,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Median',
                value: formatDuration(data.medianHours),
                icon: Icons.analytics_outlined,
                color: Colors.green,
              ),
            ),
            SizedBox(
              width: cardWidth,
              child: SummaryStatCard(
                label: 'Deployments',
                value: '${data.count}',
                icon: Icons.rocket_launch,
                color: Colors.green,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildError(BuildContext context, Object error) {
    return Center(
      child: Column(
        children: [
          Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
          const SizedBox(height: 8),
          Text('Error loading data: $error'),
        ],
      ),
    );
  }

  Widget _buildMeasurementsTable(
      BuildContext context, LeadTimeForChanges data) {
    final measurements = data.measurements.map((m) {
      final deployedAt = DateTime.tryParse(m.deployedAt);
      return Measurement(
        id: m.deploymentId.toString(),
        title: 'Deployment #${m.deploymentId}',
        subtitle: 'First commit to deploy',
        value: formatDuration(m.leadTimeHours),
        timestamp: deployedAt,
        sortValue: m.leadTimeHours,
        icon: Icons.timer,
        color: _getLeadTimeColor(m.leadTimeHours),
      );
    }).toList();

    return MeasurementsTable(
      title: 'Recent Deployments',
      measurements: measurements,
      defaultSort: MeasurementSortOption.newestFirst,
    );
  }

  Color _getLeadTimeColor(double hours) {
    if (hours < 1) return Colors.green;
    if (hours < 24) return Colors.blue;
    if (hours < 168) return Colors.orange;
    return Colors.red;
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
    final overallAsync = ref.watch(leadTimeProvider);
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
            color: Colors.green,
            formattedValue: formatDuration(data.averageHours),
          ));
        }
      },
    );

    // Add per-repo data
    for (var i = 0; i < repos.length; i++) {
      final repo = repos[i];
      final dataAsync = ref.watch(leadTimeByRepoProvider(repo.id));

      dataAsync.when(
        loading: () => isLoading = true,
        error: (e, _) => errorMessage ??= e.toString(),
        data: (data) {
          if (data.count > 0) {
            dataList.add(RepoComparisonData(
              repoId: repo.id!,
              repoName: repo.name,
              value: data.averageHours,
              color: _entityColors[i % _entityColors.length],
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
        child: Text('No lead time data available'),
      );
    }

    return RepoComparisonChart(
      data: dataList,
      title: 'Average Lead Time',
      valueLabel: 'Hours',
      valueFormatter: (value) => formatDuration(value),
    );
  }
}

/// Multi-developer comparison chart section that includes overall data.
class _MultiDeveloperComparisonSection extends ConsumerWidget {
  final List<Developer> developers;

  const _MultiDeveloperComparisonSection({required this.developers});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overallAsync = ref.watch(leadTimeProvider);
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
            repoName: 'All Developers',
            value: data.averageHours,
            color: Colors.green,
            formattedValue: formatDuration(data.averageHours),
          ));
        }
      },
    );

    // Add per-developer data
    for (var i = 0; i < developers.length; i++) {
      final dev = developers[i];
      final dataAsync = ref.watch(leadTimeByDeveloperProvider(dev.login));

      dataAsync.when(
        loading: () => isLoading = true,
        error: (e, _) => errorMessage ??= e.toString(),
        data: (data) {
          if (data.count > 0) {
            dataList.add(RepoComparisonData(
              repoId: i + 1,
              repoName: dev.login,
              value: data.averageHours,
              color: _entityColors[i % _entityColors.length],
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
        child: Text('No lead time data available'),
      );
    }

    return RepoComparisonChart(
      data: dataList,
      title: 'Average Lead Time by Developer',
      valueLabel: 'Hours',
      valueFormatter: (value) => formatDuration(value),
    );
  }
}
