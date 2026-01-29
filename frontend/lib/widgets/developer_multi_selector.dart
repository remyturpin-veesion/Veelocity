import 'package:flutter/material.dart';
import '../models/developer.dart';

/// Multi-select developer widget with inline checkboxes.
class DeveloperMultiSelector extends StatelessWidget {
  final List<Developer> developers;
  final Set<String> selectedLogins;
  final ValueChanged<Set<String>> onChanged;

  const DeveloperMultiSelector({
    super.key,
    required this.developers,
    required this.selectedLogins,
    required this.onChanged,
  });

  bool get allSelected =>
      developers.isNotEmpty &&
      (selectedLogins.isEmpty || selectedLogins.length == developers.length);

  bool get someSelected =>
      selectedLogins.isNotEmpty && selectedLogins.length < developers.length;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Select all checkbox
        _InlineCheckbox(
          label: 'All',
          isSelected: allSelected,
          isIndeterminate: someSelected,
          onChanged: (value) {
            if (value) {
              // Checking "All" → select all developers (empty set = all)
              onChanged({});
            } else {
              // Unchecking "All" → select just the first developer
              // (we need at least one selected)
              if (developers.isNotEmpty) {
                onChanged({developers.first.login});
              }
            }
          },
        ),
        const SizedBox(width: 8),
        Container(
          width: 1,
          height: 24,
          color: Colors.grey.withValues(alpha: 0.3),
        ),
        const SizedBox(width: 8),
        // Individual developer checkboxes
        Flexible(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: developers.map((dev) {
                final isSelected = selectedLogins.isEmpty ||
                    selectedLogins.contains(dev.login);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _InlineCheckbox(
                    label: dev.login,
                    isSelected: isSelected,
                    onChanged: (selected) {
                      _toggleDeveloper(dev.login, selected);
                    },
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  void _toggleDeveloper(String login, bool selected) {
    // If currently "all selected" (empty set), switching to individual selection
    if (selectedLogins.isEmpty) {
      if (selected) {
        // Clicking on already-selected developer when all are selected -> no change
        return;
      } else {
        // Unselecting one developer -> select all others
        final newSelection = developers.map((d) => d.login).toSet();
        newSelection.remove(login);
        onChanged(newSelection);
      }
    } else {
      final newSelection = Set<String>.from(selectedLogins);
      if (selected) {
        newSelection.add(login);
        // If all developers are now selected, switch to empty set (all)
        if (newSelection.length == developers.length) {
          onChanged({});
        } else {
          onChanged(newSelection);
        }
      } else {
        newSelection.remove(login);
        // Don't allow empty selection - keep at least one
        if (newSelection.isEmpty) {
          return;
        }
        onChanged(newSelection);
      }
    }
  }
}

class _InlineCheckbox extends StatelessWidget {
  final String label;
  final bool isSelected;
  final bool isIndeterminate;
  final ValueChanged<bool> onChanged;

  const _InlineCheckbox({
    required this.label,
    required this.isSelected,
    this.isIndeterminate = false,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isActive = isSelected && !isIndeterminate;

    // Outline style: selected = border + checkmark, no fill (lighter look)
    final activeColor = theme.colorScheme.primary;
    final borderColor = isActive
        ? activeColor.withValues(alpha: 0.6)
        : theme.colorScheme.outline.withValues(alpha: 0.5);
    final textColor =
        isActive ? theme.colorScheme.primary : theme.colorScheme.onSurface;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onChanged(!isSelected),
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: IgnorePointer(
                  child: Checkbox(
                    value: isIndeterminate ? null : isSelected,
                    tristate: isIndeterminate,
                    onChanged: (_) {}, // Handled by InkWell
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isActive ? FontWeight.w500 : FontWeight.normal,
                  color: textColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
