import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/developer.dart';
import '../services/providers.dart';

/// A card displaying developer info, contribution stats, and Linear metrics.
class DeveloperCard extends ConsumerWidget {
  final Developer developer;
  final VoidCallback? onTap;

  const DeveloperCard({
    super.key,
    required this.developer,
    this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linearAsync =
        ref.watch(linearOverviewForDeveloperProvider(developer.login));

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundImage: developer.avatar != null
                        ? NetworkImage(developer.avatar!)
                        : null,
                    backgroundColor: Colors.grey[300],
                    child: developer.avatar == null
                        ? Text(
                            developer.login[0].toUpperCase(),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          developer.login,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${developer.totalContributions} contributions',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey[600],
                                  ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StatItem(
                    icon: Icons.merge,
                    value: developer.prsMerged,
                    label: 'Merged',
                    color: Colors.green,
                  ),
                  _StatItem(
                    icon: Icons.rate_review,
                    value: developer.reviewsGiven,
                    label: 'Reviews',
                    color: Colors.blue,
                  ),
                  _StatItem(
                    icon: Icons.comment,
                    value: developer.commentsMade,
                    label: 'Comments',
                    color: Colors.orange,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _LinearSection(linearAsync: linearAsync),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact Linear metrics block: issues completed, backlog, avg time in state.
class _LinearSection extends StatelessWidget {
  final AsyncValue<dynamic> linearAsync;

  const _LinearSection({required this.linearAsync});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accentColor =
        isDark ? Colors.purple.shade300 : Colors.purple.shade700;
    final surfaceColor = isDark
        ? Colors.purple.withValues(alpha: 0.12)
        : Colors.purple.withValues(alpha: 0.06);
    final textColor = theme.colorScheme.onSurface;
    final labelColor = theme.colorScheme.onSurfaceVariant;

    return linearAsync.when(
      data: (overview) {
        if (overview == null) return const SizedBox.shrink();
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 14, color: accentColor),
                  const SizedBox(width: 6),
                  Text(
                    'Linear',
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: textColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _LinearStat(
                    value: overview.issuesCompleted,
                    label: 'Done',
                    valueColor: textColor,
                    labelColor: labelColor,
                  ),
                  _LinearStat(
                    value: overview.backlogCount,
                    label: 'Backlog',
                    valueColor: textColor,
                    labelColor: labelColor,
                  ),
                  _LinearStat(
                    value: overview.timeInStateCount > 0
                        ? '${overview.timeInStateAverageHours.toStringAsFixed(1)}h'
                        : '—',
                    label: 'Avg time',
                    valueColor: textColor,
                    labelColor: labelColor,
                  ),
                ],
              ),
            ],
          ),
        );
      },
      loading: () => Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(Icons.check_circle_outline, size: 14, color: accentColor),
            const SizedBox(width: 6),
            Text(
              'Linear',
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
            ),
            const Spacer(),
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: accentColor,
              ),
            ),
          ],
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _LinearStat extends StatelessWidget {
  final dynamic value;
  final String label;
  final Color valueColor;
  final Color labelColor;

  const _LinearStat({
    required this.value,
    required this.label,
    required this.valueColor,
    required this.labelColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value is int ? value.toString() : value as String,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: valueColor,
              ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: labelColor,
              ),
        ),
      ],
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final int value;
  final String label;
  final Color color;

  const _StatItem({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(height: 4),
        Text(
          value.toString(),
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
        ),
      ],
    );
  }
}
