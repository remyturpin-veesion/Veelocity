import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/sync_coverage.dart';
import '../services/providers.dart';
import 'trend_chart.dart';

/// Connector type for "Import this day" (github and linear use import-range; github_actions uses full sync).
enum CoverageConnector { github, githubActions, linear }

extension on CoverageConnector {
  String get apiValue {
    switch (this) {
      case CoverageConnector.github:
        return 'github';
      case CoverageConnector.githubActions:
        return 'github_actions';
      case CoverageConnector.linear:
        return 'linear';
    }
  }
}

/// One section on the Data Coverage page: title, chart (data by day), and "Import this day" button.
class DataCoverageSection extends ConsumerStatefulWidget {
  final String title;
  final Color color;
  final List<DailyCountItem> data;
  final CoverageConnector connector;
  final VoidCallback? onImportComplete;

  const DataCoverageSection({
    super.key,
    required this.title,
    required this.color,
    required this.data,
    required this.connector,
    this.onImportComplete,
  });

  @override
  ConsumerState<DataCoverageSection> createState() =>
      _DataCoverageSectionState();
}

class _DataCoverageSectionState extends ConsumerState<DataCoverageSection> {
  bool _loading = false;

  Future<void> _pickAndImport() async {
    if (_loading) return;
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(2000),
      lastDate: now,
    );
    if (picked == null || !mounted) return;
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      if (widget.connector == CoverageConnector.githubActions) {
        await api.triggerSync();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Full sync started. Workflow runs will update when sync completes.',
            ),
          ),
        );
      } else {
        final result = await api.triggerImportRange(
          startDate: picked,
          endDate: null,
          connector: widget.connector.apiValue,
        );
        if (!mounted) return;
        final status = result['status'] as String?;
        final message = result['message'] as String? ?? '';
        final githubItems = result['github_items'] as int? ?? 0;
        final linearItems = result['linear_items'] as int? ?? 0;
        String snack = message;
        if (status == 'success' || status == 'partial') {
          snack =
              'Imported: $githubItems GitHub, $linearItems Linear. $message';
        }
        if (status == 'error') {
          snack = 'Import failed: $message';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(snack),
            backgroundColor: status == 'error' ? Colors.red : null,
          ),
        );
      }
      ref.invalidate(syncCoverageProvider);
      ref.invalidate(dailyCoverageProvider);
      widget.onImportComplete?.call();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Import failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trendData = widget.data
        .map((d) => TrendDataPoint(label: d.date, value: d.count.toDouble()))
        .toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _iconForConnector(widget.connector),
                  color: widget.color,
                  size: 24,
                ),
                const SizedBox(width: 8),
                Text(
                  widget.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: _loading ? null : _pickAndImport,
                  icon: _loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.file_download, size: 18),
                  label: Text(_loading ? 'Importing…' : 'Import this day'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 220,
              child: trendData.isEmpty
                  ? Center(
                      child: Text(
                        'No data for this category yet',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    )
                  : TrendChart(
                      data: trendData,
                      color: widget.color,
                      height: 200,
                    ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconForConnector(CoverageConnector c) {
    switch (c) {
      case CoverageConnector.github:
        return Icons.code;
      case CoverageConnector.githubActions:
        return Icons.play_arrow;
      case CoverageConnector.linear:
        return Icons.assignment;
    }
  }
}
