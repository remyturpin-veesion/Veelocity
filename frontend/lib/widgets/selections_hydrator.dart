import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/providers.dart';
import '../services/selection_persistence_service.dart';

/// Restores filter selections from browser storage on startup and persists
/// changes so selections survive refresh/navigation.
class SelectionsHydrator extends ConsumerStatefulWidget {
  const SelectionsHydrator({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SelectionsHydrator> createState() => _SelectionsHydratorState();
}

class _SelectionsHydratorState extends ConsumerState<SelectionsHydrator> {
  bool _hasHydrated = false;
  Timer? _saveDebounce;

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  Future<void> _hydrate() async {
    final saved = await SelectionPersistenceService.load();
    if (!mounted) return;
    if (saved != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(selectedDateRangeProvider.notifier).state =
            saved.toDateRange();
        ref.read(selectedRepoIdsProvider.notifier).state =
            saved.repoIds.toSet();
        ref.read(selectedDeveloperLoginsProvider.notifier).state =
            saved.developerLogins.toSet();
        ref.read(selectedTeamIdsProvider.notifier).state =
            saved.teamIds.toSet();
        ref.read(selectedTimeInStateStageIdsProvider.notifier).state =
            saved.timeInStateStageIds.toSet();
        final tab = saved.toMainTab();
        if (tab != null) {
          ref.read(mainTabProvider.notifier).state = tab;
        }
        if (mounted) setState(() => _hasHydrated = true);
      });
    } else {
      setState(() => _hasHydrated = true);
    }
  }

  void _scheduleSave() {
    if (!_hasHydrated) return;
    _saveDebounce?.cancel();
    final r = ref;
    _saveDebounce = Timer(const Duration(milliseconds: 300), () {
      _save(r);
    });
  }

  static void _save(WidgetRef ref) {
    final dateRange = ref.read(selectedDateRangeProvider);
    final repoIds = ref.read(selectedRepoIdsProvider);
    final developerLogins = ref.read(selectedDeveloperLoginsProvider);
    final teamIds = ref.read(selectedTeamIdsProvider);
    final timeInStateStageIds = ref.read(selectedTimeInStateStageIdsProvider);
    final mainTab = ref.read(mainTabProvider);
    SelectionPersistenceService.save(
      dateRange: dateRange,
      repoIds: repoIds,
      developerLogins: developerLogins,
      teamIds: teamIds,
      timeInStateStageIds: timeInStateStageIds,
      mainTab: mainTab,
    );
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(selectedDateRangeProvider, (_, __) => _scheduleSave());
    ref.listen(selectedRepoIdsProvider, (_, __) => _scheduleSave());
    ref.listen(selectedDeveloperLoginsProvider, (_, __) => _scheduleSave());
    ref.listen(selectedTeamIdsProvider, (_, __) => _scheduleSave());
    ref.listen(selectedTimeInStateStageIdsProvider, (_, __) => _scheduleSave());
    ref.listen(mainTabProvider, (_, __) => _scheduleSave());
    return widget.child;
  }
}
