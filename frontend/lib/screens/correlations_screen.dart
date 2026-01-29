import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../models/correlation.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/empty_state.dart';

/// Screen for viewing pairwise metric correlations (Feature 11).
class CorrelationsScreen extends ConsumerWidget {
  const CorrelationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncCorr = ref.watch(correlationsProvider);

    return BaseScaffold(
      currentMetricId: 'correlations',
      isHome: false,
      child: asyncCorr.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorEmptyState(
          message: _formatErrorMessage(error),
          onRetry: () => ref.invalidate(correlationsProvider),
        ),
        data: (response) => _buildContent(context, ref, response),
      ),
    );
  }

  String _formatErrorMessage(Object error) {
    if (error is DioException &&
        error.type == DioExceptionType.connectionError) {
      return 'Unable to reach the server.\n'
          'Ensure the backend is running.\n'
          'Expected URL: ${AppConfig.apiBaseUrl}';
    }
    return 'Failed to load correlations.\n$error';
  }

  Widget _buildContent(
    BuildContext context,
    WidgetRef ref,
    CorrelationsResponse response,
  ) {
    if (response.pairs.isEmpty) {
      return NoDataEmptyState(
        dataType: 'correlations',
        helpText: 'Not enough period data to compute correlations.\n'
            'Need at least 3 aligned periods (e.g. 3 weeks) for deployment frequency, '
            'throughput, and lead time. Adjust filters or sync more data.',
        onRetrySync: () => ref.invalidate(correlationsProvider),
      );
    }

    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Breadcrumb(label: 'Dashboard', route: '/'),
          const SizedBox(height: 16),
          Text(
            'Correlation Analysis',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Pearson correlation between metrics over time (by ${response.period}). '
            'Values from -1 (inverse) to +1 (aligned).',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 24),
          ...response.pairs.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _CorrelationCard(pair: p),
            ),
          ),
        ],
      ),
    );
  }
}

class _CorrelationCard extends StatelessWidget {
  final CorrelationPair pair;

  const _CorrelationCard({required this.pair});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final r = pair.correlation;
    final color = r >= 0.3
        ? Colors.green
        : r <= -0.3
            ? Colors.orange
            : theme.colorScheme.onSurfaceVariant;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    CorrelationPair.metricLabel(pair.metricA),
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    CorrelationPair.metricLabel(pair.metricB),
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  r.toStringAsFixed(2),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
                Text(
                  '${pair.periodCount} periods',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
