import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/date_range.dart';
import '../models/saved_selections.dart';
import '../services/providers.dart';

const _storageKey = 'veelocity_selections';

/// Loads and saves filter selections to browser storage (SharedPreferences / localStorage).
class SelectionPersistenceService {
  SelectionPersistenceService._();

  /// Load saved selections from storage.
  static Future<SavedSelections?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>?;
      return SavedSelections.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  /// Save current selections to storage.
  static Future<void> save({
    required DateRange dateRange,
    required Set<int> repoIds,
    required Set<String> developerLogins,
    required Set<int> teamIds,
    required Set<String> timeInStateStageIds,
    required MainTab mainTab,
  }) async {
    final kind = dateRange is PresetDateRange ? 'preset' : 'custom';
    final period = dateRange is PresetDateRange ? dateRange.period.name : null;
    final customStart = dateRange is CustomDateRange
        ? dateRange.startDate.toIso8601String().split('T').first
        : null;
    final customEnd = dateRange is CustomDateRange
        ? dateRange.endDate.toIso8601String().split('T').first
        : null;
    final saved = SavedSelections(
      dateRangeKind: kind,
      period: period,
      customStart: customStart,
      customEnd: customEnd,
      repoIds: repoIds.toList(),
      developerLogins: developerLogins.toList(),
      teamIds: teamIds.toList(),
      timeInStateStageIds: timeInStateStageIds.toList(),
      mainTab: mainTab.name,
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(saved.toJson()));
  }
}
