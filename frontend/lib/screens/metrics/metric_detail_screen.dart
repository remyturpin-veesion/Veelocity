import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/metric_info.dart';
import '../../services/providers.dart';
import '../../widgets/period_selector.dart';
import '../../widgets/repo_selector.dart';

/// Base screen for displaying metric details.
///
/// Provides a consistent layout with:
/// - AppBar with metric name
/// - Info section with description and calculation
/// - Summary stats section
/// - Filters (period and repo)
/// - Custom content (chart, measurements table, etc.)
class MetricDetailScreen extends ConsumerWidget {
  final MetricInfo metricInfo;
  final Widget Function(BuildContext context, WidgetRef ref) summaryBuilder;
  final Widget Function(BuildContext context, WidgetRef ref) contentBuilder;
  final VoidCallback? onRefresh;

  const MetricDetailScreen({
    super.key,
    required this.metricInfo,
    required this.summaryBuilder,
    required this.contentBuilder,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final selectedRepo = ref.watch(selectedRepoProvider);
    final reposAsync = ref.watch(repositoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(metricInfo.name),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          if (onRefresh != null)
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh',
              onPressed: onRefresh,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Info Section
            _MetricInfoCard(metricInfo: metricInfo),
            const SizedBox(height: 24),

            // Summary Stats
            summaryBuilder(context, ref),
            const SizedBox(height: 24),

            // Filters
            _FiltersSection(
              selectedPeriod: selectedPeriod,
              selectedRepo: selectedRepo,
              reposAsync: reposAsync,
              onPeriodChanged: (period) {
                ref.read(selectedPeriodProvider.notifier).state = period;
              },
              onRepoChanged: (repo) {
                ref.read(selectedRepoProvider.notifier).state = repo;
              },
            ),
            const SizedBox(height: 24),

            // Custom Content
            contentBuilder(context, ref),
          ],
        ),
      ),
    );
  }
}

/// Collapsible card showing metric description and calculation.
class _MetricInfoCard extends StatefulWidget {
  final MetricInfo metricInfo;

  const _MetricInfoCard({required this.metricInfo});

  @override
  State<_MetricInfoCard> createState() => _MetricInfoCardState();
}

class _MetricInfoCardState extends State<_MetricInfoCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: widget.metricInfo.color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      widget.metricInfo.icon,
                      color: widget.metricInfo.color,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'About this metric',
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        Text(
                          'Tap to ${_isExpanded ? 'collapse' : 'expand'}',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey[600],
                                  ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: Colors.grey[600],
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(),
                  const SizedBox(height: 8),
                  _InfoSection(
                    title: 'What it measures',
                    content: widget.metricInfo.description,
                    icon: Icons.info_outline,
                  ),
                  const SizedBox(height: 16),
                  _InfoSection(
                    title: 'How it\'s calculated',
                    content: widget.metricInfo.calculation,
                    icon: Icons.calculate_outlined,
                  ),
                  const SizedBox(height: 16),
                  _TipsSection(tips: widget.metricInfo.tips),
                ],
              ),
            ),
            crossFadeState: _isExpanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  final String title;
  final String content;
  final IconData icon;

  const _InfoSection({
    required this.title,
    required this.content,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: Colors.grey[600]),
            const SizedBox(width: 8),
            Text(
              title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[700],
                  ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          content,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey[800],
                height: 1.5,
              ),
        ),
      ],
    );
  }
}

class _TipsSection extends StatelessWidget {
  final List<String> tips;

  const _TipsSection({required this.tips});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.lightbulb_outline, size: 16, color: Colors.amber[700]),
            const SizedBox(width: 8),
            Text(
              'Tips for improvement',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[700],
                  ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...tips.map((tip) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('• ', style: TextStyle(color: Colors.grey[600])),
                  Expanded(
                    child: Text(
                      tip,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[800],
                          ),
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }
}

class _FiltersSection extends StatelessWidget {
  final TimePeriod selectedPeriod;
  final RepoOption selectedRepo;
  final AsyncValue<List<RepoOption>> reposAsync;
  final ValueChanged<TimePeriod> onPeriodChanged;
  final ValueChanged<RepoOption> onRepoChanged;

  const _FiltersSection({
    required this.selectedPeriod,
    required this.selectedRepo,
    required this.reposAsync,
    required this.onPeriodChanged,
    required this.onRepoChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Filters',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          runSpacing: 12,
          children: [
            PeriodSelector(
              selected: selectedPeriod,
              onChanged: onPeriodChanged,
            ),
            reposAsync.when(
              loading: () => const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (repos) => RepoSelector(
                repos: repos,
                selected: selectedRepo,
                onChanged: onRepoChanged,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A card widget for displaying a summary stat.
class SummaryStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData? icon;
  final Color? color;

  const SummaryStatCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.color,
  });

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
            if (icon != null) ...[
              Icon(icon, size: 20, color: color ?? Colors.grey[600]),
              const SizedBox(height: 8),
            ],
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: color ?? Theme.of(context).primaryColor,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
