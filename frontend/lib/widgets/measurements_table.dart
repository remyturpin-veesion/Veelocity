import 'package:flutter/material.dart';

/// Sort options for measurements table.
enum MeasurementSortOption {
  newestFirst('Newest first', Icons.arrow_downward),
  oldestFirst('Oldest first', Icons.arrow_upward),
  highestValue('Highest value', Icons.trending_up),
  lowestValue('Lowest value', Icons.trending_down);

  final String label;
  final IconData icon;

  const MeasurementSortOption(this.label, this.icon);
}

/// A measurement item to display in the table.
class Measurement {
  final String id;
  final String title;
  final String? subtitle;
  final String value;
  final DateTime? timestamp;
  final double? sortValue; // Numeric value for sorting (e.g., hours)
  final IconData? icon;
  final Color? color;

  const Measurement({
    required this.id,
    required this.title,
    this.subtitle,
    required this.value,
    this.timestamp,
    this.sortValue,
    this.icon,
    this.color,
  });
}

/// A table/list widget for displaying individual measurements.
class MeasurementsTable extends StatefulWidget {
  final String title;
  final List<Measurement> measurements;
  final int maxItems;
  final VoidCallback? onViewAll;
  final bool showTimestamp;
  final bool enableSorting;
  final MeasurementSortOption defaultSort;

  const MeasurementsTable({
    super.key,
    required this.title,
    required this.measurements,
    this.maxItems = 10,
    this.onViewAll,
    this.showTimestamp = true,
    this.enableSorting = true,
    this.defaultSort = MeasurementSortOption.newestFirst,
  });

  @override
  State<MeasurementsTable> createState() => _MeasurementsTableState();
}

class _MeasurementsTableState extends State<MeasurementsTable> {
  late MeasurementSortOption _currentSort;

  @override
  void initState() {
    super.initState();
    _currentSort = widget.defaultSort;
  }

  List<Measurement> get _sortedMeasurements {
    final sorted = List<Measurement>.from(widget.measurements);

    switch (_currentSort) {
      case MeasurementSortOption.newestFirst:
        sorted.sort((a, b) {
          if (a.timestamp == null && b.timestamp == null) return 0;
          if (a.timestamp == null) return 1;
          if (b.timestamp == null) return -1;
          return b.timestamp!.compareTo(a.timestamp!);
        });
      case MeasurementSortOption.oldestFirst:
        sorted.sort((a, b) {
          if (a.timestamp == null && b.timestamp == null) return 0;
          if (a.timestamp == null) return 1;
          if (b.timestamp == null) return -1;
          return a.timestamp!.compareTo(b.timestamp!);
        });
      case MeasurementSortOption.highestValue:
        sorted.sort((a, b) {
          if (a.sortValue == null && b.sortValue == null) return 0;
          if (a.sortValue == null) return 1;
          if (b.sortValue == null) return -1;
          return b.sortValue!.compareTo(a.sortValue!);
        });
      case MeasurementSortOption.lowestValue:
        sorted.sort((a, b) {
          if (a.sortValue == null && b.sortValue == null) return 0;
          if (a.sortValue == null) return 1;
          if (b.sortValue == null) return -1;
          return a.sortValue!.compareTo(b.sortValue!);
        });
    }

    return sorted;
  }

  List<MeasurementSortOption> get _availableSortOptions {
    final hasTimestamps = widget.measurements.any((m) => m.timestamp != null);
    final hasSortValues = widget.measurements.any((m) => m.sortValue != null);

    final options = <MeasurementSortOption>[];
    if (hasTimestamps) {
      options.add(MeasurementSortOption.newestFirst);
      options.add(MeasurementSortOption.oldestFirst);
    }
    if (hasSortValues) {
      options.add(MeasurementSortOption.highestValue);
      options.add(MeasurementSortOption.lowestValue);
    }

    // If no sortable fields, return all options (sorting won't change order)
    return options.isEmpty ? MeasurementSortOption.values.toList() : options;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.measurements.isEmpty) {
      return _EmptyMeasurements(title: widget.title);
    }

    final sortedItems = _sortedMeasurements;
    final displayItems = sortedItems.take(widget.maxItems).toList();
    final hasMore = widget.measurements.length > widget.maxItems;
    final availableOptions = _availableSortOptions;
    final showSortDropdown = widget.enableSorting && availableOptions.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                widget.title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            if (showSortDropdown)
              _SortDropdown(
                currentSort: _currentSort,
                availableOptions: availableOptions,
                onChanged: (option) {
                  setState(() {
                    _currentSort = option;
                  });
                },
              ),
            if (hasMore && widget.onViewAll != null)
              TextButton(
                onPressed: widget.onViewAll,
                child: Text('View all (${widget.measurements.length})'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          clipBehavior: Clip.antiAlias,
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: displayItems.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = displayItems[index];
              return _MeasurementTile(
                measurement: item,
                showTimestamp: widget.showTimestamp,
              );
            },
          ),
        ),
        if (hasMore && widget.onViewAll == null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '${widget.measurements.length - widget.maxItems} more items not shown',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
          ),
      ],
    );
  }
}

class _SortDropdown extends StatelessWidget {
  final MeasurementSortOption currentSort;
  final List<MeasurementSortOption> availableOptions;
  final ValueChanged<MeasurementSortOption> onChanged;

  const _SortDropdown({
    required this.currentSort,
    required this.availableOptions,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<MeasurementSortOption>(
          value: currentSort,
          isDense: true,
          icon: const Icon(Icons.unfold_more, size: 18),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[700],
              ),
          items: availableOptions.map((option) {
            return DropdownMenuItem(
              value: option,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(option.icon, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 6),
                  Text(option.label),
                ],
              ),
            );
          }).toList(),
          onChanged: (value) {
            if (value != null) {
              onChanged(value);
            }
          },
        ),
      ),
    );
  }
}

class _MeasurementTile extends StatelessWidget {
  final Measurement measurement;
  final bool showTimestamp;

  const _MeasurementTile({
    required this.measurement,
    required this.showTimestamp,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: measurement.icon != null
          ? Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: (measurement.color ?? Colors.grey).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                measurement.icon,
                color: measurement.color ?? Colors.grey[600],
                size: 20,
              ),
            )
          : null,
      title: Text(
        measurement.title,
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: measurement.subtitle != null || (showTimestamp && measurement.timestamp != null)
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (measurement.subtitle != null)
                  Text(
                    measurement.subtitle!,
                    style: TextStyle(color: Colors.grey[600], fontSize: 12),
                  ),
                if (showTimestamp && measurement.timestamp != null)
                  Text(
                    _formatTimestamp(measurement.timestamp!),
                    style: TextStyle(color: Colors.grey[500], fontSize: 11),
                  ),
              ],
            )
          : null,
      trailing: Text(
        measurement.value,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: measurement.color ?? Theme.of(context).primaryColor,
            ),
      ),
    );
  }

  String _formatTimestamp(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inDays == 0) {
      return 'Today';
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} days ago';
    } else {
      return '${dt.month}/${dt.day}/${dt.year}';
    }
  }
}

class _EmptyMeasurements extends StatelessWidget {
  final String title;

  const _EmptyMeasurements({required this.title});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.inbox_outlined, size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 8),
                  Text(
                    'No data available',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey[600],
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Helper function to format duration in hours to a human-readable string.
String formatDuration(double hours) {
  if (hours == 0) {
    return 'N/A';
  } else if (hours < 1) {
    return '${(hours * 60).round()} min';
  } else if (hours < 24) {
    return '${hours.toStringAsFixed(1)} hrs';
  } else {
    return '${(hours / 24).toStringAsFixed(1)} days';
  }
}
