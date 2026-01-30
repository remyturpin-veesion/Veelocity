import 'package:flutter/material.dart';
import '../models/linear_metrics.dart';
import 'filter_chip_button.dart';

/// Multi-select teams as clickable chips (same style as Repos/Developers).
/// Empty set = all teams selected.
class TeamMultiSelector extends StatelessWidget {
  final List<LinearTeam> teams;
  final Set<int> selectedTeamIds;
  final ValueChanged<Set<int>> onChanged;

  const TeamMultiSelector({
    super.key,
    required this.teams,
    required this.selectedTeamIds,
    required this.onChanged,
  });

  bool get allSelected =>
      teams.isNotEmpty &&
      (selectedTeamIds.isEmpty || selectedTeamIds.length == teams.length);

  void _toggleTeam(int teamId, bool selected) {
    if (selectedTeamIds.isEmpty) {
      if (selected) return;
      final newSelection = teams.map((t) => t.id).toSet();
      newSelection.remove(teamId);
      onChanged(newSelection);
    } else {
      final newSelection = Set<int>.from(selectedTeamIds);
      if (selected) {
        newSelection.add(teamId);
        if (newSelection.length == teams.length) {
          onChanged({});
        } else {
          onChanged(newSelection);
        }
      } else {
        newSelection.remove(teamId);
        if (newSelection.isEmpty) return;
        onChanged(newSelection);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        FilterChipButton(
          label: 'All',
          isSelected: allSelected,
          icon: Icons.group,
          onTap: () {
            if (allSelected) {
              if (teams.isNotEmpty) onChanged({teams.first.id});
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
              children: teams.map((t) {
                final isSelected =
                    selectedTeamIds.isEmpty || selectedTeamIds.contains(t.id);
                return FilterChipButton(
                  label: '${t.name} (${t.key})',
                  isSelected: isSelected,
                  icon: Icons.group,
                  onTap: () => _toggleTeam(t.id, !isSelected),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
