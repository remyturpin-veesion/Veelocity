import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/dashboard_preferences.dart';

const _storageKey = 'dashboard_preferences';

/// Notifier for dashboard visibility preferences with persistence.
class DashboardPreferencesNotifier extends StateNotifier<DashboardPreferences> {
  DashboardPreferencesNotifier()
      : super(DashboardPreferences.defaultPreferences) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw != null) {
      try {
        final json = jsonDecode(raw) as Map<String, dynamic>?;
        if (json != null) {
          state = DashboardPreferences.fromJson(json);
        }
      } catch (_) {
        // Keep default on parse error
      }
    }
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(state.toJson()));
  }

  Future<void> update(DashboardPreferences next) async {
    state = next;
    await _save();
  }

  Future<void> setSectionAnomalies(bool value) async {
    state = state.copyWith(showSectionAnomalies: value);
    await _save();
  }

  Future<void> setSectionRecommendations(bool value) async {
    state = state.copyWith(showSectionRecommendations: value);
    await _save();
  }

  Future<void> setSectionReliability(bool value) async {
    state = state.copyWith(showSectionReliability: value);
    await _save();
  }

  Future<void> setSectionAlerts(bool value) async {
    state = state.copyWith(showSectionAlerts: value);
    await _save();
  }

  Future<void> setKpiDeploymentFrequency(bool value) async {
    state = state.copyWith(showKpiDeploymentFrequency: value);
    await _save();
  }

  Future<void> setKpiLeadTime(bool value) async {
    state = state.copyWith(showKpiLeadTime: value);
    await _save();
  }

  Future<void> setKpiPrReviewTime(bool value) async {
    state = state.copyWith(showKpiPrReviewTime: value);
    await _save();
  }

  Future<void> setKpiPrMergeTime(bool value) async {
    state = state.copyWith(showKpiPrMergeTime: value);
    await _save();
  }

  Future<void> setKpiCycleTime(bool value) async {
    state = state.copyWith(showKpiCycleTime: value);
    await _save();
  }

  Future<void> setKpiThroughput(bool value) async {
    state = state.copyWith(showKpiThroughput: value);
    await _save();
  }

  Future<void> resetToDefaults() async {
    state = DashboardPreferences.defaultPreferences;
    await _save();
  }
}

final dashboardPreferencesProvider =
    StateNotifierProvider<DashboardPreferencesNotifier, DashboardPreferences>(
  (ref) => DashboardPreferencesNotifier(),
);
