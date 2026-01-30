import 'package:flutter/material.dart';

/// Available time period options.
enum TimePeriod {
  days7(7, '7 days'),
  days30(30, '30 days'),
  days90(90, '90 days');

  final int days;
  final String label;

  const TimePeriod(this.days, this.label);

  DateTime get startDate => DateTime.now().subtract(Duration(days: days));
  DateTime get endDate => DateTime.now();
}

/// A segmented button for selecting time periods (7 / 30 / 90 days).
/// [selectedPreset] is null when the current range is custom.
class PeriodSelector extends StatelessWidget {
  final TimePeriod? selectedPreset;
  final ValueChanged<TimePeriod> onPresetSelected;

  const PeriodSelector({
    super.key,
    required this.selectedPreset,
    required this.onPresetSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<TimePeriod>(
      segments: TimePeriod.values.map((period) {
        return ButtonSegment<TimePeriod>(
          value: period,
          label: Text(period.label),
        );
      }).toList(),
      selected: selectedPreset != null ? {selectedPreset!} : {},
      onSelectionChanged: (selection) {
        if (selection.isNotEmpty) {
          onPresetSelected(selection.first);
        }
      },
      style: const ButtonStyle(
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
