import 'package:flutter/material.dart';
import 'repo_selector.dart';

/// Multi-select repository widget with inline checkboxes.
class RepoMultiSelector extends StatelessWidget {
  final List<RepoOption> repos;
  final Set<int> selectedRepoIds;
  final ValueChanged<Set<int>> onChanged;

  const RepoMultiSelector({
    super.key,
    required this.repos,
    required this.selectedRepoIds,
    required this.onChanged,
  });

  bool get allSelected =>
      repos.isNotEmpty &&
      (selectedRepoIds.isEmpty || selectedRepoIds.length == repos.length);

  bool get someSelected =>
      selectedRepoIds.isNotEmpty && selectedRepoIds.length < repos.length;

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
              // Checking "All" → select all repos (empty set = all)
              onChanged({});
            } else {
              // Unchecking "All" → select just the first repo
              // (we need at least one selected)
              if (repos.isNotEmpty) {
                onChanged({repos.first.id!});
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
        // Individual repo checkboxes
        Flexible(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: repos.map((repo) {
                final isSelected = selectedRepoIds.isEmpty ||
                    selectedRepoIds.contains(repo.id);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _InlineCheckbox(
                    label: _getShortName(repo.name),
                    isSelected: isSelected,
                    onChanged: (selected) {
                      _toggleRepo(repo.id!, selected);
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

  String _getShortName(String fullName) {
    // If it's org/repo format, just show repo name
    if (fullName.contains('/')) {
      return fullName.split('/').last;
    }
    return fullName;
  }

  void _toggleRepo(int repoId, bool selected) {
    // If currently "all selected" (empty set), switching to individual selection
    if (selectedRepoIds.isEmpty) {
      if (selected) {
        // Clicking on already-selected repo when all are selected -> no change
        return;
      } else {
        // Unselecting one repo -> select all others
        final newSelection = repos.map((r) => r.id!).toSet();
        newSelection.remove(repoId);
        onChanged(newSelection);
      }
    } else {
      final newSelection = Set<int>.from(selectedRepoIds);
      if (selected) {
        newSelection.add(repoId);
        // If all repos are now selected, switch to empty set (all)
        if (newSelection.length == repos.length) {
          onChanged({});
        } else {
          onChanged(newSelection);
        }
      } else {
        newSelection.remove(repoId);
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
    final isDark = theme.brightness == Brightness.dark;
    final isActive = isSelected && !isIndeterminate;

    // Use colors that work well in both light and dark themes
    final activeColor = theme.colorScheme.primary;
    final textColor = isActive
        ? (isDark ? theme.colorScheme.primary : theme.colorScheme.primary)
        : theme.colorScheme.onSurface;

    return InkWell(
      onTap: () => onChanged(!isSelected),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isActive
              ? activeColor.withValues(alpha: isDark ? 0.2 : 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isActive
                ? activeColor.withValues(alpha: 0.5)
                : theme.colorScheme.outline.withValues(alpha: 0.5),
          ),
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
    );
  }
}
