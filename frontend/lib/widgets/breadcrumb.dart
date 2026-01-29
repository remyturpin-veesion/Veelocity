import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// A pill-style back navigation breadcrumb (arrow + label).
///
/// Matches the style used on the PR Health / PR Detail pages:
/// rounded background, left arrow, tappable to navigate back.
class Breadcrumb extends StatelessWidget {
  /// Label shown next to the back arrow (e.g. "Dashboard", "PR Health Scores").
  final String label;

  /// Navigation target when tapped. If null, [onTap] must be provided.
  final String? route;

  /// Optional custom tap handler. If set, [route] is ignored.
  final VoidCallback? onTap;

  const Breadcrumb({
    super.key,
    required this.label,
    this.route,
    this.onTap,
  }) : assert(route != null || onTap != null,
            'Either route or onTap must be provided');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap ?? (route != null ? () => context.go(route!) : null),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.arrow_back,
              size: 20,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.primary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
