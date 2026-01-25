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

/// A segmented button for selecting time periods.
class PeriodSelector extends StatelessWidget {
  final TimePeriod selected;
  final ValueChanged<TimePeriod> onChanged;

  const PeriodSelector({
    super.key,
    required this.selected,
    required this.onChanged,
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
      selected: {selected},
      onSelectionChanged: (selection) {
        if (selection.isNotEmpty) {
          onChanged(selection.first);
        }
      },
      style: const ButtonStyle(
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
