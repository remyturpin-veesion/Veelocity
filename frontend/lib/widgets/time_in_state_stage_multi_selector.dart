import 'package:flutter/material.dart';
import '../models/linear_metrics.dart';
import 'filter_chip_button.dart';

/// Multi-select workflow stages for Time-in-State (show/hide cards).
/// Same style as TeamMultiSelector / RepoMultiSelector. Empty set = all stages.
class TimeInStateStageMultiSelector extends StatelessWidget {
  final List<LinearTimeInStateStage> stages;
  final Set<String> selectedStageIds;
  final ValueChanged<Set<String>> onChanged;

  const TimeInStateStageMultiSelector({
    super.key,
    required this.stages,
    required this.selectedStageIds,
    required this.onChanged,
  });

  bool get allSelected =>
      stages.isNotEmpty &&
      (selectedStageIds.isEmpty || selectedStageIds.length == stages.length);

  void _toggleStage(String stageId, bool selected) {
    if (selectedStageIds.isEmpty) {
      if (selected) return;
      final newSelection = stages.map((s) => s.id).toSet()..remove(stageId);
      onChanged(newSelection);
    } else {
      final newSelection = Set<String>.from(selectedStageIds);
      if (selected) {
        newSelection.add(stageId);
        if (newSelection.length == stages.length) {
          onChanged({});
        } else {
          onChanged(newSelection);
        }
      } else {
        newSelection.remove(stageId);
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
          icon: Icons.view_column,
          onTap: () {
            if (allSelected) {
              if (stages.isNotEmpty) onChanged({stages.first.id});
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
              children: stages.map((s) {
                final isSelected =
                    selectedStageIds.isEmpty || selectedStageIds.contains(s.id);
                return FilterChipButton(
                  label: '${s.label} (${s.count})',
                  isSelected: isSelected,
                  onTap: () => _toggleStage(s.id, !isSelected),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
