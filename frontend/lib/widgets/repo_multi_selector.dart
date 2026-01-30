import 'package:flutter/material.dart';
import 'filter_chip_button.dart';
import 'repo_selector.dart';

/// Multi-select repositories as clickable chips (same style as Linear teams).
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

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        FilterChipButton(
          label: 'All',
          isSelected: allSelected,
          icon: Icons.folder_outlined,
          onTap: () {
            if (allSelected) {
              if (repos.isNotEmpty) onChanged({repos.first.id!});
            } else {
              onChanged({});
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
        Flexible(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: repos.map((repo) {
                final isSelected = selectedRepoIds.isEmpty ||
                    selectedRepoIds.contains(repo.id);
                return FilterChipButton(
                  label: _getShortName(repo.name),
                  isSelected: isSelected,
                  icon: Icons.folder_outlined,
                  onTap: () => _toggleRepo(repo.id!, !isSelected),
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
