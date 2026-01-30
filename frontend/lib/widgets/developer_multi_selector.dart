import 'package:flutter/material.dart';
import '../models/developer.dart';
import 'filter_chip_button.dart';

/// Multi-select developers as clickable chips (same style as Linear teams).
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

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        FilterChipButton(
          label: 'All',
          isSelected: allSelected,
          icon: Icons.person_outline,
          onTap: () {
            if (allSelected) {
              if (developers.isNotEmpty) onChanged({developers.first.login});
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
              children: developers.map((dev) {
                final isSelected = selectedLogins.isEmpty ||
                    selectedLogins.contains(dev.login);
                return FilterChipButton(
                  label: dev.login,
                  isSelected: isSelected,
                  icon: Icons.person_outline,
                  onTap: () => _toggleDeveloper(dev.login, !isSelected),
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
