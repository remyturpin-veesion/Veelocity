import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../models/recommendation.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/empty_state.dart';

/// Screen for viewing prioritized recommendations.
class RecommendationsScreen extends ConsumerWidget {
  const RecommendationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRecs = ref.watch(recommendationsProvider);

    return BaseScaffold(
      currentMetricId: 'recommendations',
      isHome: false,
      child: asyncRecs.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorEmptyState(
          message: _formatErrorMessage(error),
          onRetry: () => ref.invalidate(recommendationsProvider),
        ),
        data: (response) => _buildContent(context, ref, response),
      ),
    );
  }

  String _formatErrorMessage(Object error) {
    if (error is DioException &&
        error.type == DioExceptionType.connectionError) {
      return 'Impossible de joindre le serveur.\n'
          'Vérifiez que le backend est démarré.\n'
          'URL attendue : ${AppConfig.apiBaseUrl}';
    }
    return 'Échec du chargement des recommandations.\n$error';
  }

  Widget _buildContent(
    BuildContext context,
    WidgetRef ref,
    RecommendationsResponse response,
  ) {
    if (response.recommendations.isEmpty) {
      return NoDataEmptyState(
        dataType: 'recommendations',
        helpText:
            'Aucune recommandation pour la période et les filtres sélectionnés.\n'
            'Les métriques sont dans les objectifs ou pas assez de données.',
        onRetrySync: () => ref.invalidate(recommendationsProvider),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Breadcrumb(label: 'Dashboard', route: '/'),
          const SizedBox(height: 16),
          Text(
            'Recommandations',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Priorisées par impact (haut → moyen).',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 20),
          ...response.recommendations.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _RecommendationCard(recommendation: r),
            ),
          ),
        ],
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  final Recommendation recommendation;

  const _RecommendationCard({required this.recommendation});

  @override
  Widget build(BuildContext context) {
    final priorityColor = _priorityColor(recommendation.priority);
    final priorityLabel = _priorityLabel(recommendation.priority);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    recommendation.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: priorityColor.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    priorityLabel,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: priorityColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              recommendation.description,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (recommendation.metricContext != null &&
                recommendation.metricContext!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                recommendation.metricContext!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _priorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'high':
        return Colors.red;
      case 'medium':
        return Colors.orange;
      case 'low':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  String _priorityLabel(String priority) {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'Priorité haute';
      case 'medium':
        return 'Priorité moyenne';
      case 'low':
        return 'Priorité basse';
      default:
        return priority;
    }
  }
}
