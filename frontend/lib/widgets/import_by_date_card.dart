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

/// Card with optional sync status and expandable "Import by date" form.
/// When [syncStatusRow] is non-null, the card shows that row + an "Import" button
/// that expands to reveal the date/source form. When null, the form is always visible.
/// When [initialConnector] is [ImportConnector.github] or [ImportConnector.linear],
/// the source is preselected and locked (no dropdown).
class ImportByDateCard extends ConsumerStatefulWidget {
  final VoidCallback? onImportComplete;

  /// When set, shown at the top of the card; an "Import" button beside it expands the form.
  final Widget? syncStatusRow;

  /// Preselects the source. When github or linear, the source is locked (dropdown hidden).
  final ImportConnector? initialConnector;

  const ImportByDateCard({
    super.key,
    this.onImportComplete,
    this.syncStatusRow,
    this.initialConnector,
  });

  @override
  ConsumerState<ImportByDateCard> createState() => _ImportByDateCardState();
}

class _ImportByDateCardState extends ConsumerState<ImportByDateCard> {
  static final _dateFormat = DateFormat('yyyy-MM-dd');

  late DateTime _startDate;
  DateTime? _endDate;
  late ImportConnector _connector;
  bool _loading = false;
  bool _useRange = false;
  bool _expanded = false;

  bool get _isConnectorLocked =>
      widget.initialConnector == ImportConnector.github ||
      widget.initialConnector == ImportConnector.linear;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, now.day);
    _connector = widget.initialConnector ?? ImportConnector.all;
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

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 8),
        Text(
          'Force import data for a single day or date range (GitHub PRs and/or Linear issues).',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            const Text('Start date:'),
            const SizedBox(width: 12),
            FilledButton.tonal(
              onPressed: _loading ? null : _pickStartDate,
              child: Text(_dateFormat.format(_startDate)),
            ),
            const SizedBox(width: 24),
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
                  _endDate != null ? _dateFormat.format(_endDate!) : 'Pick end',
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            const Text('Source:'),
            const SizedBox(width: 12),
            if (_isConnectorLocked)
              Text(
                _connector.label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
              )
            else
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasSyncRow = widget.syncStatusRow != null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // One row: sync status (if any) + Import button that toggles expansion
            Row(
              children: [
                if (widget.syncStatusRow != null) ...[
                  Expanded(child: widget.syncStatusRow!),
                  const SizedBox(width: 12),
                ],
                FilledButton.tonalIcon(
                  onPressed: _loading
                      ? null
                      : () {
                          setState(() => _expanded = !_expanded);
                        },
                  icon: Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 20,
                  ),
                  label: Text(
                      hasSyncRow && !_expanded ? 'Import' : 'Import by date'),
                ),
              ],
            ),
            // Expandable form
            if (hasSyncRow)
              AnimatedSize(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                child: _expanded ? _buildForm() : const SizedBox.shrink(),
              )
            else
              _buildForm(),
          ],
        ),
      ),
    );
  }
}
