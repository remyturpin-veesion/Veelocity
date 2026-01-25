import 'package:flutter/material.dart';

/// A reusable empty state widget.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  /// No deployments found.
  factory EmptyState.noDeployments({VoidCallback? onSync}) {
    return EmptyState(
      icon: Icons.rocket_launch_outlined,
      title: 'No deployments yet',
      message: 'Deployments will appear here once synced from GitHub Actions.',
      actionLabel: onSync != null ? 'Sync now' : null,
      onAction: onSync,
    );
  }

  /// No PRs found.
  factory EmptyState.noPRs({VoidCallback? onSync}) {
    return EmptyState(
      icon: Icons.merge_outlined,
      title: 'No pull requests',
      message: 'PRs will appear here once synced from GitHub.',
      actionLabel: onSync != null ? 'Sync now' : null,
      onAction: onSync,
    );
  }

  /// Linear not connected.
  factory EmptyState.noLinear({VoidCallback? onConfigure}) {
    return EmptyState(
      icon: Icons.link_off,
      title: 'Linear not connected',
      message: 'Connect Linear to track cycle time and issue metrics.',
      actionLabel: onConfigure != null ? 'Configure' : null,
      onAction: onConfigure,
    );
  }

  /// Generic no data.
  factory EmptyState.noData() {
    return const EmptyState(
      icon: Icons.inbox_outlined,
      title: 'No data available',
      message: 'Data will appear here once synced.',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 56,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                textAlign: TextAlign.center,
              ),
              if (message != null) ...[
                const SizedBox(height: 8),
                Text(
                  message!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey[600],
                      ),
                  textAlign: TextAlign.center,
                ),
              ],
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: 20),
                FilledButton.tonal(
                  onPressed: onAction,
                  child: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
