import '../services/providers.dart';
import '../widgets/period_selector.dart';
import 'date_range.dart';

/// Persisted filter selections for restoration in the browser.
class SavedSelections {
  const SavedSelections({
    this.dateRangeKind = 'preset',
    this.period,
    this.customStart,
    this.customEnd,
    this.repoIds = const [],
    this.developerLogins = const [],
    this.teamIds = const [],
    this.timeInStateStageIds = const [],
    this.mainTab,
  });

  final String dateRangeKind;
  final String? period;
  final String? customStart;
  final String? customEnd;
  final List<int> repoIds;
  final List<String> developerLogins;
  final List<int> teamIds;
  final List<String> timeInStateStageIds;
  final String? mainTab;

  Map<String, dynamic> toJson() => {
        'dateRangeKind': dateRangeKind,
        'period': period,
        'customStart': customStart,
        'customEnd': customEnd,
        'repoIds': repoIds,
        'developerLogins': developerLogins,
        'teamIds': teamIds,
        'timeInStateStageIds': timeInStateStageIds,
        'mainTab': mainTab,
      };

  static SavedSelections? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    return SavedSelections(
      dateRangeKind: json['dateRangeKind'] as String? ?? 'preset',
      period: json['period'] as String?,
      customStart: json['customStart'] as String?,
      customEnd: json['customEnd'] as String?,
      repoIds: (json['repoIds'] as List<dynamic>?)
              ?.map((e) => (e is int) ? e : int.tryParse(e.toString()))
              .whereType<int>()
              .toList() ??
          [],
      developerLogins:
          (json['developerLogins'] as List<dynamic>?)?.cast<String>() ?? [],
      teamIds: (json['teamIds'] as List<dynamic>?)
              ?.map((e) => (e is int) ? e : int.tryParse(e.toString()))
              .whereType<int>()
              .toList() ??
          [],
      timeInStateStageIds:
          (json['timeInStateStageIds'] as List<dynamic>?)?.cast<String>() ?? [],
      mainTab: json['mainTab'] as String?,
    );
  }

  /// Build [DateRange] from saved preset or custom values.
  DateRange toDateRange() {
    if (dateRangeKind == 'custom' &&
        customStart != null &&
        customEnd != null &&
        customStart!.isNotEmpty &&
        customEnd!.isNotEmpty) {
      final start = DateTime.tryParse(customStart!);
      final end = DateTime.tryParse(customEnd!);
      if (start != null && end != null) {
        return CustomDateRange(startDate: start, endDate: end);
      }
    }
    final p = period;
    if (p != null) {
      try {
        return PresetDateRange(TimePeriod.values.byName(p));
      } catch (_) {
        // fall through to default
      }
    }
    return PresetDateRange(TimePeriod.days30);
  }

  /// Build [MainTab] from saved name.
  MainTab? toMainTab() {
    if (mainTab == null) return null;
    try {
      return MainTab.values.byName(mainTab!);
    } catch (_) {
      return null;
    }
  }
}
