import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../services/providers.dart';

/// Connector choice for date-range import.
enum ImportConnector { github, linear, all }

extension on ImportConnector {
  String get apiValue {
    switch (this) {
      case ImportConnector.github:
        return 'github';
      case ImportConnector.linear:
        return 'linear';
      case ImportConnector.all:
        return 'all';
    }
  }

  String get label {
    switch (this) {
      case ImportConnector.github:
        return 'GitHub';
      case ImportConnector.linear:
        return 'Linear';
      case ImportConnector.all:
        return 'Both';
    }
  }
}

/// Card with date pickers and button to force-import data for a day or date range.
class ImportByDateCard extends ConsumerStatefulWidget {
  final VoidCallback? onImportComplete;

  const ImportByDateCard({
    super.key,
    this.onImportComplete,
  });

  @override
  ConsumerState<ImportByDateCard> createState() => _ImportByDateCardState();
}

class _ImportByDateCardState extends ConsumerState<ImportByDateCard> {
  static final _dateFormat = DateFormat('yyyy-MM-dd');

  late DateTime _startDate;
  DateTime? _endDate;
  ImportConnector _connector = ImportConnector.all;
  bool _loading = false;
  bool _useRange = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, now.day);
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (picked != null && mounted) {
      setState(() {
        _startDate = picked;
        if (_endDate != null && _endDate!.isBefore(picked)) {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _pickEndDate() async {
    final initial = _endDate ?? _startDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: _startDate,
      lastDate: DateTime.now(),
    );
    if (picked != null && mounted) {
      setState(() => _endDate = picked);
    }
  }

  Future<void> _runImport() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final result = await api.triggerImportRange(
        startDate: _startDate,
        endDate: _useRange ? _endDate : null,
        connector: _connector.apiValue,
      );
      if (!mounted) return;
      final status = result['status'] as String?;
      final message = result['message'] as String? ?? '';
      final githubItems = result['github_items'] as int? ?? 0;
      final linearItems = result['linear_items'] as int? ?? 0;
      final errors = result['errors'] as List<dynamic>?;
      String snack = message;
      if (status == 'success' || status == 'partial') {
        snack = 'Imported: $githubItems GitHub, $linearItems Linear. $message';
        ref.invalidate(syncCoverageProvider);
        widget.onImportComplete?.call();
      }
      if (errors != null && errors.isNotEmpty) {
        snack += ' ${errors.join(' ')}';
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(snack),
          backgroundColor: status == 'error' ? Colors.red : null,
        ),
      );
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.download,
                  color: Theme.of(context).colorScheme.primary,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  'Import by date',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Force import data for a single day or date range (GitHub PRs and/or Linear issues).',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            const SizedBox(height: 16),
            // Start date
            Row(
              children: [
                const Text('Start date:'),
                const SizedBox(width: 12),
                FilledButton.tonal(
                  onPressed: _loading ? null : _pickStartDate,
                  child: Text(_dateFormat.format(_startDate)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Range toggle + End date
            Row(
              children: [
                Checkbox(
                  value: _useRange,
                  onChanged: _loading
                      ? null
                      : (v) {
                          setState(() {
                            _useRange = v ?? false;
                            if (!_useRange)
                              _endDate = null;
                            else
                              _endDate ??= _startDate;
                          });
                        },
                ),
                const Text('Date range'),
                if (_useRange) ...[
                  const SizedBox(width: 12),
                  FilledButton.tonal(
                    onPressed: _loading ? null : _pickEndDate,
                    child: Text(
                      _endDate != null
                          ? _dateFormat.format(_endDate!)
                          : 'Pick end',
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            // Connector
            Row(
              children: [
                const Text('Source:'),
                const SizedBox(width: 12),
                DropdownButton<ImportConnector>(
                  value: _connector,
                  items: ImportConnector.values
                      .map((c) => DropdownMenuItem(
                            value: c,
                            child: Text(c.label),
                          ))
                      .toList(),
                  onChanged: _loading
                      ? null
                      : (c) {
                          if (c != null) setState(() => _connector = c);
                        },
                ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _loading ? null : _runImport,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.file_download),
              label: Text(_loading ? 'Importing…' : 'Import'),
            ),
          ],
        ),
      ),
    );
  }
}
