import '../widgets/period_selector.dart';

/// Represents the selected date range for metrics (preset or custom).
sealed class DateRange {
  DateTime get startDate;
  DateTime get endDate;
  String get displayLabel;

  /// Short label for headers, e.g. "Last 30 days" or "2024-01-01 – 2024-01-15".
  String get summaryLabel => switch (this) {
        PresetDateRange(:final period) => 'Last ${period.label}',
        CustomDateRange() => displayLabel,
      };
}

/// Preset period (7, 30, 90 days).
class PresetDateRange extends DateRange {
  PresetDateRange(this.period);

  final TimePeriod period;

  @override
  DateTime get startDate => period.startDate;

  @override
  DateTime get endDate => period.endDate;

  @override
  String get displayLabel => period.label;
}

/// User-selected start and end dates.
class CustomDateRange extends DateRange {
  CustomDateRange({required this.startDate, required this.endDate});

  @override
  final DateTime startDate;

  @override
  final DateTime endDate;

  @override
  String get displayLabel => _format(startDate, endDate);

  static String _format(DateTime start, DateTime end) {
    final s =
        '${start.year}-${start.month.toString().padLeft(2, '0')}-${start.day.toString().padLeft(2, '0')}';
    final e =
        '${end.year}-${end.month.toString().padLeft(2, '0')}-${end.day.toString().padLeft(2, '0')}';
    return '$s – $e';
  }
}
