import 'package:flutter/material.dart';

/// Contextual help tooltip with info icon.
class HelpTooltip extends StatelessWidget {
  final String message;
  final IconData icon;
  final double iconSize;
  final Color? iconColor;

  const HelpTooltip({
    super.key,
    required this.message,
    this.icon = Icons.help_outline,
    this.iconSize = 18,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        iconColor ?? theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.6);

    return Tooltip(
      message: message,
      preferBelow: false,
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: theme.colorScheme.inverseSurface,
        borderRadius: BorderRadius.circular(8),
      ),
      textStyle: theme.textTheme.bodyMedium?.copyWith(
        color: theme.colorScheme.onInverseSurface,
      ),
      child: Icon(
        icon,
        size: iconSize,
        color: color,
      ),
    );
  }
}

/// Info banner with icon and message.
class InfoBanner extends StatelessWidget {
  final String message;
  final IconData icon;
  final Color? backgroundColor;
  final Color? textColor;
  final VoidCallback? onDismiss;

  const InfoBanner({
    super.key,
    required this.message,
    this.icon = Icons.info_outline,
    this.backgroundColor,
    this.textColor,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bgColor = backgroundColor ??
        theme.colorScheme.primaryContainer.withValues(alpha: 0.5);
    final fgColor = textColor ?? theme.colorScheme.onPrimaryContainer;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: fgColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: fgColor,
              ),
            ),
          ),
          if (onDismiss != null) ...[
            const SizedBox(width: 8),
            IconButton(
              icon: Icon(Icons.close, size: 18, color: fgColor),
              onPressed: onDismiss,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ],
      ),
    );
  }
}

/// Label with tooltip - useful for filter labels.
class LabelWithHelp extends StatelessWidget {
  final String label;
  final String? helpText;
  final bool required;

  const LabelWithHelp({
    super.key,
    required this.label,
    this.helpText,
    this.required = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        if (required)
          Text(
            ' *',
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.error,
              fontWeight: FontWeight.w600,
            ),
          ),
        if (helpText != null) ...[
          const SizedBox(width: 4),
          HelpTooltip(message: helpText!),
        ],
      ],
    );
  }
}

/// Expandable help section - for more detailed guidance.
class ExpandableHelp extends StatefulWidget {
  final String title;
  final String content;
  final IconData icon;

  const ExpandableHelp({
    super.key,
    required this.title,
    required this.content,
    this.icon = Icons.lightbulb_outline,
  });

  @override
  State<ExpandableHelp> createState() => _ExpandableHelpState();
}

class _ExpandableHelpState extends State<ExpandableHelp> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest,
      child: InkWell(
        onTap: () => setState(() => _isExpanded = !_isExpanded),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    widget.icon,
                    size: 20,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ),
                  Icon(
                    _isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
              if (_isExpanded) ...[
                const SizedBox(height: 12),
                Text(
                  widget.content,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
