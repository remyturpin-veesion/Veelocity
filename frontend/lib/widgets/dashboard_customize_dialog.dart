import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/dashboard_preferences_provider.dart';

/// Dialog to customize which dashboard sections and KPI cards are visible.
class DashboardCustomizeDialog extends ConsumerWidget {
  const DashboardCustomizeDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (context) => const DashboardCustomizeDialog(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(dashboardPreferencesProvider);
    final notifier = ref.read(dashboardPreferencesProvider.notifier);

    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.dashboard_customize),
          SizedBox(width: 8),
          Text('Customize dashboard'),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'KPI cards',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                  ),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              title: const Text('Deployment frequency'),
              value: prefs.showKpiDeploymentFrequency,
              onChanged: (v) => notifier.setKpiDeploymentFrequency(v),
            ),
            SwitchListTile(
              title: const Text('Lead time for changes'),
              value: prefs.showKpiLeadTime,
              onChanged: (v) => notifier.setKpiLeadTime(v),
            ),
            SwitchListTile(
              title: const Text('PR review time'),
              value: prefs.showKpiPrReviewTime,
              onChanged: (v) => notifier.setKpiPrReviewTime(v),
            ),
            SwitchListTile(
              title: const Text('PR merge time'),
              value: prefs.showKpiPrMergeTime,
              onChanged: (v) => notifier.setKpiPrMergeTime(v),
            ),
            SwitchListTile(
              title: const Text('Cycle time'),
              value: prefs.showKpiCycleTime,
              onChanged: (v) => notifier.setKpiCycleTime(v),
            ),
            SwitchListTile(
              title: const Text('Throughput'),
              value: prefs.showKpiThroughput,
              onChanged: (v) => notifier.setKpiThroughput(v),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () async {
            await notifier.resetToDefaults();
          },
          child: const Text('Reset to default'),
        ),
        const SizedBox(width: 8),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Done'),
        ),
      ],
    );
  }
}
