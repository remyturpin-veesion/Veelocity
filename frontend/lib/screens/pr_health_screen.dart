import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../models/pr_health.dart';
import '../services/providers.dart';
import 'pr_detail_screen.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/empty_state.dart';

/// Screen for viewing PR health scores.
class PRHealthScreen extends ConsumerStatefulWidget {
  const PRHealthScreen({super.key});

  @override
  ConsumerState<PRHealthScreen> createState() => _PRHealthScreenState();
}

class _PRHealthScreenState extends ConsumerState<PRHealthScreen> {
  String _sortColumn = 'health_score';
  bool _sortAscending = true;
  int? _selectedPrId;

  @override
  Widget build(BuildContext context) {
    final prHealthAsync = ref.watch(prHealthProvider);

    return BaseScaffold(
      currentMetricId: 'pr_health',
      isHome: false,
      child: _selectedPrId != null
          ? _buildPRDetailInline(context)
          : prHealthAsync.when(
              loading: () => _buildLoadingState(),
              error: (error, stack) => ErrorEmptyState(
                message: _formatErrorMessage(error),
                onRetry: () => ref.invalidate(prHealthProvider),
              ),
              data: (response) => _buildContent(context, response),
            ),
    );
  }

  Widget _buildPRDetailInline(BuildContext context) {
    final asyncDetail = ref.watch(prDetailProvider(_selectedPrId!));

    return asyncDetail.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorEmptyState(
        message: error.toString(),
        onRetry: () => ref.invalidate(prDetailProvider(_selectedPrId!)),
      ),
      data: (pr) => SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Breadcrumb(
              label: 'PR Health Scores',
              onTap: () => setState(() => _selectedPrId = null),
            ),
            const SizedBox(height: 16),
            PRDetailView(pr: pr),
          ],
        ),
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
    return 'Échec du chargement des données PR Health.\n$error';
  }

  Widget _buildLoadingState() {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }

  Widget _buildContent(BuildContext context, PRHealthResponse response) {
    if (response.prHealthScores.isEmpty) {
      return NoDataEmptyState(
        dataType: 'PRs',
        helpText: 'No pull requests found in the selected time period.\n'
            'Adjust your filters or sync more data.',
        onRetrySync: () => ref.invalidate(prHealthProvider),
      );
    }

    // Sort PRs
    final sortedPRs = List<PRHealthScore>.from(response.prHealthScores);
    sortedPRs.sort((a, b) {
      int comparison;
      switch (_sortColumn) {
        case 'health_score':
          comparison = a.healthScore.compareTo(b.healthScore);
          break;
        case 'pr_number':
          comparison = a.prNumber.compareTo(b.prNumber);
          break;
        case 'author':
          comparison = a.author.compareTo(b.author);
          break;
        case 'lines_changed':
          comparison = a.metrics.linesChanged.compareTo(b.metrics.linesChanged);
          break;
        case 'review_rounds':
          comparison = a.metrics.reviewRounds.compareTo(b.metrics.reviewRounds);
          break;
        default:
          comparison = 0;
      }
      return _sortAscending ? comparison : -comparison;
    });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Breadcrumb(label: 'Dashboard', route: '/'),
          const SizedBox(height: 16),
          // Summary cards
          if (response.summary != null) _buildSummaryCards(response.summary!),
          const SizedBox(height: 24),

          // Table
          _buildPRHealthTable(context, sortedPRs),
        ],
      ),
    );
  }

  Widget _buildSummaryCards(PRHealthSummary summary) {
    final theme = Theme.of(context);

    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _buildSummaryCard(
          'Total PRs',
          summary.totalPrs.toString(),
          Icons.merge,
          theme.colorScheme.primary,
        ),
        _buildSummaryCard(
          'Average Score',
          summary.averageScore.toStringAsFixed(1),
          Icons.score,
          _getColorForScore(summary.averageScore.toInt()),
        ),
        _buildSummaryCard(
          'Excellent',
          summary.byCategory['excellent'].toString(),
          Icons.stars,
          Color(HealthCategory.excellent.colorValue),
        ),
        _buildSummaryCard(
          'Poor',
          summary.byCategory['poor'].toString(),
          Icons.warning,
          Color(HealthCategory.poor.colorValue),
        ),
      ],
    );
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

  Widget _buildPRHealthTable(
    BuildContext context,
    List<PRHealthScore> prs,
  ) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'PR Health Scores',
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
                    label: const Text('Score'),
                    onSort: (columnIndex, ascending) =>
                        _onSort('health_score', ascending),
                  ),
                  DataColumn(
                    label: const Text('Category'),
                  ),
                  DataColumn(
                    label: const Text('PR#'),
                    numeric: true,
                    onSort: (columnIndex, ascending) =>
                        _onSort('pr_number', ascending),
                  ),
                  DataColumn(
                    label: const Text('Title'),
                  ),
                  DataColumn(
                    label: const Text('Author'),
                    onSort: (columnIndex, ascending) =>
                        _onSort('author', ascending),
                  ),
                  DataColumn(
                    label: const Text('Lines'),
                    numeric: true,
                    onSort: (columnIndex, ascending) =>
                        _onSort('lines_changed', ascending),
                  ),
                  DataColumn(
                    label: const Text('Reviews'),
                    numeric: true,
                    onSort: (columnIndex, ascending) =>
                        _onSort('review_rounds', ascending),
                  ),
                  DataColumn(
                    label: const Text('Comments'),
                    numeric: true,
                  ),
                  DataColumn(
                    label: const Text('Issues'),
                  ),
                ],
                rows: prs.map((pr) => _buildPRRow(context, pr)).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  DataRow _buildPRRow(BuildContext context, PRHealthScore pr) {
    final color = Color(pr.healthCategory.colorValue);

    return DataRow(
      cells: [
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              pr.scorePercentage,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        DataCell(
          Text(
            pr.healthCategory.label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        DataCell(
          InkWell(
            onTap: () => setState(() => _selectedPrId = pr.prId),
            child: Text(
              '#${pr.prNumber}',
              style: const TextStyle(
                color: Colors.blue,
                decoration: TextDecoration.underline,
              ),
            ),
          ),
        ),
        DataCell(
          SizedBox(
            width: 300,
            child: InkWell(
              onTap: () => setState(() => _selectedPrId = pr.prId),
              child: Text(
                pr.prTitle,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.blue,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ),
        DataCell(Text(pr.author)),
        DataCell(Text(pr.metrics.linesChanged.toString())),
        DataCell(Text(pr.metrics.reviewRounds.toString())),
        DataCell(Text(pr.metrics.commentCount.toString())),
        DataCell(
          pr.hasIssues
              ? Tooltip(
                  message: pr.issues.join('\n'),
                  child: Chip(
                    label: Text(pr.issues.length.toString()),
                    backgroundColor: Colors.red.withValues(alpha: 0.1),
                    side: BorderSide(
                      color: Colors.red.withValues(alpha: 0.3),
                    ),
                  ),
                )
              : const Text('-'),
        ),
      ],
    );
  }

  void _onSort(String column, bool ascending) {
    setState(() {
      _sortColumn = column;
      _sortAscending = ascending;
    });
  }

  int? _getSortColumnIndex() {
    switch (_sortColumn) {
      case 'health_score':
        return 0;
      case 'pr_number':
        return 2;
      case 'author':
        return 4;
      case 'lines_changed':
        return 5;
      case 'review_rounds':
        return 6;
      default:
        return null;
    }
  }

  Color _getColorForScore(int score) {
    if (score >= 85) {
      return Color(HealthCategory.excellent.colorValue);
    } else if (score >= 70) {
      return Color(HealthCategory.good.colorValue);
    } else if (score >= 50) {
      return Color(HealthCategory.fair.colorValue);
    } else {
      return Color(HealthCategory.poor.colorValue);
    }
  }
}
