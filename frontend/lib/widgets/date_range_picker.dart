import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/date_range.dart';
import '../services/providers.dart';

/// Compact date range picker: start and end date, placed to the left of the period selector.
/// Tapping a date opens the system date picker; changing dates sets a [CustomDateRange].
class DateRangePicker extends ConsumerWidget {
  const DateRangePicker({super.key});

  static final _dateFormat = DateFormat('MMM d, y');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dateRange = ref.watch(selectedDateRangeProvider);
    final start = dateRange.startDate;
    final end = dateRange.endDate;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _DateChip(
          label: 'From',
          date: start,
          onTap: () => _pickDate(context, ref, start: true, initial: start),
        ),
        const SizedBox(width: 8),
        _DateChip(
          label: 'To',
          date: end,
          onTap: () => _pickDate(context, ref, start: false, initial: end),
        ),
      ],
    );
  }

  static Future<void> _pickDate(
    BuildContext context,
    WidgetRef ref, {
    required bool start,
    required DateTime initial,
  }) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !context.mounted) return;
    final current = ref.read(selectedDateRangeProvider);
    final s = current.startDate;
    final e = current.endDate;
    if (start) {
      final newEnd = picked.isAfter(e) ? picked : e;
      ref.read(selectedDateRangeProvider.notifier).state =
          CustomDateRange(startDate: picked, endDate: newEnd);
    } else {
      final newStart = picked.isBefore(s) ? picked : s;
      ref.read(selectedDateRangeProvider.notifier).state =
          CustomDateRange(startDate: newStart, endDate: picked);
    }
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({
    required this.label,
    required this.date,
    required this.onTap,
  });

  final String label;
  final DateTime date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context)
          .colorScheme
          .surfaceContainerHighest
          .withValues(alpha: 0.5),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$label: ',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.7),
                    ),
              ),
              Text(
                DateRangePicker._dateFormat.format(date),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
