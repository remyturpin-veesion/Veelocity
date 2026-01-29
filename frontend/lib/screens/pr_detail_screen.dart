import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import '../core/config.dart';
import '../models/pr_detail.dart';
import '../services/providers.dart';
import '../widgets/base_scaffold.dart';
import '../widgets/empty_state.dart';

/// Reusable PR detail body (header, stats, health, reviews, comments, commits).
/// Used both in PRDetailScreen and inline in PR Health screen.
class PRDetailView extends StatelessWidget {
  final PRDetail pr;

  const PRDetailView({super.key, required this.pr});

  @override
  Widget build(BuildContext context) {
    return _PRDetailBody(pr: pr);
  }
}

class _PRDetailBody extends StatelessWidget {
  final PRDetail pr;

  const _PRDetailBody({required this.pr});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('yyyy-MM-dd HH:mm');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header: title, repo, author, dates
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${pr.number} · ${pr.title}',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (pr.repository != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      pr.repository!.fullName,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 16,
                    runSpacing: 4,
                    children: [
                      Text(
                        'Author: ${pr.authorLogin}',
                        style: theme.textTheme.bodySmall,
                      ),
                      if (pr.createdAt != null)
                        Text(
                          'Opened: ${dateFormat.format(pr.createdAt!)}',
                          style: theme.textTheme.bodySmall,
                        ),
                      if (pr.mergedAt != null)
                        Text(
                          'Merged: ${dateFormat.format(pr.mergedAt!)}',
                          style: theme.textTheme.bodySmall,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (pr.githubUrl.isNotEmpty)
              FilledButton.icon(
                onPressed: () => _openUrl(context, pr.githubUrl),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('View on GitHub'),
              ),
          ],
        ),
        const SizedBox(height: 16),

        // Stats: additions, deletions, state
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: [
            _Chip(
              icon: Icons.add,
              label: '+${pr.additions}',
              color: Colors.green,
            ),
            _Chip(
              icon: Icons.remove,
              label: '-${pr.deletions}',
              color: Colors.red,
            ),
            _Chip(
              label: pr.state,
              color: theme.colorScheme.primary,
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Health card (if present)
        if (pr.health != null) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.health_and_safety,
                        color: _healthColor(pr.health!.healthCategory),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Health score: ${pr.health!.healthScore}',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        pr.health!.healthCategory,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: _healthColor(pr.health!.healthCategory),
                        ),
                      ),
                    ],
                  ),
                  if (pr.health!.issues.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    ...pr.health!.issues.map(
                      (issue) => Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '• $issue',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Reviews
        _SectionTitle(title: 'Reviews (${pr.reviews.length})'),
        const SizedBox(height: 8),
        ...pr.reviews.map(
          (r) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: Icon(
                r.state == 'APPROVED'
                    ? Icons.check_circle
                    : r.state == 'CHANGES_REQUESTED'
                        ? Icons.cancel
                        : Icons.comment,
                color: r.state == 'APPROVED'
                    ? Colors.green
                    : r.state == 'CHANGES_REQUESTED'
                        ? Colors.orange
                        : null,
              ),
              title: Text(r.reviewerLogin),
              subtitle: Text(
                '${r.state}${r.submittedAt != null ? ' · ${dateFormat.format(r.submittedAt!)}' : ''}',
              ),
            ),
          ),
        ),
        if (pr.limits != null && pr.limits!.reviewsTotal > pr.reviews.length)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              'Showing ${pr.reviews.length} of ${pr.limits!.reviewsTotal}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),

        // Comments
        _SectionTitle(title: 'Comments (${pr.comments.length})'),
        const SizedBox(height: 8),
        ...pr.comments.map(
          (c) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              title: Text(c.authorLogin),
              subtitle: Text(
                c.body,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: c.createdAt != null
                  ? Text(
                      dateFormat.format(c.createdAt!),
                      style: theme.textTheme.bodySmall,
                    )
                  : null,
            ),
          ),
        ),
        if (pr.limits != null && pr.limits!.commentsTotal > pr.comments.length)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              'Showing ${pr.comments.length} of ${pr.limits!.commentsTotal}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),

        // Commits
        _SectionTitle(title: 'Commits (${pr.commits.length})'),
        const SizedBox(height: 8),
        ...pr.commits.map(
          (c) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: const Icon(Icons.commit),
              title: Text(
                c.message.split('\n').first,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${c.sha.substring(0, 7)} · ${c.authorLogin}${c.committedAt != null ? ' · ${dateFormat.format(c.committedAt!)}' : ''}',
              ),
            ),
          ),
        ),
        if (pr.limits != null && pr.limits!.commitsTotal > pr.commits.length)
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Text(
              'Showing ${pr.commits.length} of ${pr.limits!.commitsTotal}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _openUrl(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Color _healthColor(String category) {
    switch (category.toLowerCase()) {
      case 'excellent':
        return Colors.green;
      case 'good':
        return Colors.blue;
      case 'fair':
        return Colors.amber;
      case 'poor':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}

/// Individual PR Explorer: full screen with scaffold (route /pr/:id).
class PRDetailScreen extends ConsumerWidget {
  final int prId;

  const PRDetailScreen({super.key, required this.prId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncDetail = ref.watch(prDetailProvider(prId));

    return BaseScaffold(
      isHome: false,
      showFilters: false,
      child: asyncDetail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorEmptyState(
          message: _formatError(error),
          onRetry: () => ref.invalidate(prDetailProvider(prId)),
        ),
        data: (pr) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildBreadcrumb(context),
              const SizedBox(height: 16),
              PRDetailView(pr: pr),
            ],
          ),
        ),
      ),
    );
  }

  String _formatError(Object error) {
    if (error is DioException &&
        error.type == DioExceptionType.connectionError) {
      return 'Impossible de joindre le serveur.\n${AppConfig.apiBaseUrl}';
    }
    return error.toString();
  }

  Widget _buildBreadcrumb(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: () => context.go('/metrics/pr-health'),
      borderRadius: BorderRadius.circular(8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.arrow_back, size: 20, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Text(
            'PR Health',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const _Chip({required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
