import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../models/reviewer_workload.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/empty_state.dart';

/// Screen for viewing reviewer workload distribution.
class ReviewerWorkloadScreen extends ConsumerStatefulWidget {
  const ReviewerWorkloadScreen({super.key});

  @override
  ConsumerState<ReviewerWorkloadScreen> createState() =>
      _ReviewerWorkloadScreenState();
}

class _ReviewerWorkloadScreenState
    extends ConsumerState<ReviewerWorkloadScreen> {
  String _sortColumn = 'review_count';
  bool _sortAscending = false;

  @override
  Widget build(BuildContext context) {
    final workloadAsync = ref.watch(reviewerWorkloadProvider);

    return BaseScaffold(
      currentMetricId: 'reviewer_workload',
      isHome: false,
      child: workloadAsync.when(
        loading: () => _buildLoadingState(),
        error: (error, stack) => ErrorEmptyState(
          message: _formatErrorMessage(error),
          onRetry: () => ref.invalidate(reviewerWorkloadProvider),
        ),
        data: (response) => _buildContent(context, response),
      ),
    );
  }

  String _formatErrorMessage(Object error) {
    if (error is DioException &&
        error.type == DioExceptionType.connectionError) {
      return 'Impossible de joindre le serveur.\n'
          'Vérifiez que le backend est démarré (ex. \'make dev-local\' dans le dossier backend).\n'
          'URL attendue : ${AppConfig.apiBaseUrl}';
    }
    return 'Échec du chargement des données Reviewer Workload.\n$error';
  }

  Widget _buildLoadingState() {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }

  Widget _buildContent(
    BuildContext context,
    ReviewerWorkloadResponse response,
  ) {
    if (response.workloads.isEmpty) {
      return NoDataEmptyState(
        dataType: 'reviews',
        helpText: 'No reviews found in the selected time period.\n'
            'Adjust your filters or sync more data.',
        onRetrySync: () => ref.invalidate(reviewerWorkloadProvider),
      );
    }

    final sortedWorkloads = List<ReviewerWorkload>.from(response.workloads);
    sortedWorkloads.sort((a, b) {
      int comparison;
      switch (_sortColumn) {
        case 'reviewer_login':
          comparison = a.reviewerLogin.compareTo(b.reviewerLogin);
          break;
        case 'review_count':
          comparison = a.reviewCount.compareTo(b.reviewCount);
          break;
        case 'avg_reviews_per_week':
          comparison = a.avgReviewsPerWeek.compareTo(b.avgReviewsPerWeek);
          break;
        case 'percentage_of_total':
          comparison = a.percentageOfTotal.compareTo(b.percentageOfTotal);
          break;
        default:
          comparison = 0;
      }
      return _sortAscending ? comparison : -comparison;
    });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SizedBox(
            width: constraints.maxWidth,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Breadcrumb(
                  label: 'GitHub',
                  route: '/github?tab=github',
                ),
                const SizedBox(height: 16),
                _buildSummaryCards(response.summary),
                const SizedBox(height: 24),
                _buildWorkloadTable(context, sortedWorkloads),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(WorkloadSummary summary) {
    final theme = Theme.of(context);

    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _buildSummaryCard(
          'Total Reviews',
          summary.totalReviews.toString(),
          Icons.rate_review,
          theme.colorScheme.primary,
        ),
        _buildSummaryCard(
          'Unique Reviewers',
          summary.uniqueReviewers.toString(),
          Icons.people,
          theme.colorScheme.secondary,
        ),
        _buildSummaryCard(
          'Gini Coefficient',
          summary.giniCoefficient.toStringAsFixed(2),
          Icons.balance,
          _getGiniColor(summary.giniCoefficient),
        ),
        _buildSummaryCard(
          'Bottlenecks',
          summary.hasBottleneck
              ? summary.bottleneckReviewers.length.toString()
              : '0',
          Icons.warning,
          summary.hasBottleneck ? Colors.orange : Colors.grey,
        ),
      ],
    );
  }

  Color _getGiniColor(double gini) {
    if (gini >= 0.5) return Colors.red;
    if (gini >= 0.3) return Colors.orange;
    return Colors.green;
  }

  Widget _buildSummaryCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    final theme = Theme.of(context);

    return Card(
      child: Container(
        width: 160,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(
              value,
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              title,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkloadTable(
    BuildContext context,
    List<ReviewerWorkload> workloads,
  ) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Reviewers',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                sortColumnIndex: _getSortColumnIndex(),
                sortAscending: _sortAscending,
                columns: [
                  DataColumn(
                    label: const Text('Reviewer'),
                    onSort: (_, ascending) {
                      setState(() {
                        _sortColumn = 'reviewer_login';
                        _sortAscending = ascending;
                      });
                    },
                  ),
                  DataColumn(
                    label: const Text('Reviews'),
                    numeric: true,
                    onSort: (_, ascending) {
                      setState(() {
                        _sortColumn = 'review_count';
                        _sortAscending = ascending;
                      });
                    },
                  ),
                  DataColumn(
                    label: const Text('Avg/Week'),
                    numeric: true,
                    onSort: (_, ascending) {
                      setState(() {
                        _sortColumn = 'avg_reviews_per_week';
                        _sortAscending = ascending;
                      });
                    },
                  ),
                  DataColumn(
                    label: const Text('% of Total'),
                    numeric: true,
                    onSort: (_, ascending) {
                      setState(() {
                        _sortColumn = 'percentage_of_total';
                        _sortAscending = ascending;
                      });
                    },
                  ),
                  const DataColumn(label: Text('Bottleneck')),
                  const DataColumn(label: Text('Under-utilized')),
                ],
                rows: workloads.map((w) => _buildWorkloadRow(w)).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  int? _getSortColumnIndex() {
    switch (_sortColumn) {
      case 'reviewer_login':
        return 0;
      case 'review_count':
        return 1;
      case 'avg_reviews_per_week':
        return 2;
      case 'percentage_of_total':
        return 3;
      default:
        return null;
    }
  }

  DataRow _buildWorkloadRow(ReviewerWorkload w) {
    return DataRow(
      cells: [
        DataCell(Text(w.reviewerLogin)),
        DataCell(Text(w.reviewCount.toString())),
        DataCell(Text(w.avgReviewsPerWeek.toStringAsFixed(1))),
        DataCell(Text('${w.percentageOfTotal.toStringAsFixed(1)}%')),
        DataCell(
          w.isBottleneck
              ? const Icon(Icons.warning, color: Colors.orange, size: 20)
              : const Text('-'),
        ),
        DataCell(
          w.isUnderUtilized
              ? const Icon(Icons.info_outline, color: Colors.blue, size: 20)
              : const Text('-'),
        ),
      ],
    );
  }
}
