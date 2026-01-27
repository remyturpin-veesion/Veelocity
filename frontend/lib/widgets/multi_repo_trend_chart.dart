import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

/// Data series for a single repository in the multi-repo chart.
class RepoTrendSeries {
  final int repoId;
  final String repoName;
  final List<TrendPoint> data;
  final Color color;

  RepoTrendSeries({
    required this.repoId,
    required this.repoName,
    required this.data,
    required this.color,
  });
}

/// A single data point in the trend.
class TrendPoint {
  final String period;
  final double value;

  TrendPoint({required this.period, required this.value});
}

/// A multi-line trend chart showing one line per repository.
class MultiRepoTrendChart extends StatefulWidget {
  final List<RepoTrendSeries> series;
  final String? title;
  final double height;
  final String Function(double value)? valueFormatter;

  const MultiRepoTrendChart({
    super.key,
    required this.series,
    this.title,
    this.height = 250,
    this.valueFormatter,
  });

  @override
  State<MultiRepoTrendChart> createState() => _MultiRepoTrendChartState();
}

class _MultiRepoTrendChartState extends State<MultiRepoTrendChart> {
  final Set<int> _hiddenRepoIds = {};

  @override
  Widget build(BuildContext context) {
    if (widget.series.isEmpty) {
      return SizedBox(
        height: widget.height,
        child: Center(
          child: Text(
            'No data available',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ),
      );
    }

    // Collect all unique periods across all series
    final allPeriods = <String>{};
    for (final s in widget.series) {
      for (final d in s.data) {
        allPeriods.add(d.period);
      }
    }
    final sortedPeriods = allPeriods.toList()..sort();

    if (sortedPeriods.isEmpty) {
      return SizedBox(
        height: widget.height,
        child: Center(
          child: Text(
            'No data available',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ),
      );
    }

    // Build period index map
    final periodIndex = <String, int>{};
    for (var i = 0; i < sortedPeriods.length; i++) {
      periodIndex[sortedPeriods[i]] = i;
    }

    // Calculate min/max Y values across visible series
    double minY = double.infinity;
    double maxY = double.negativeInfinity;
    for (final s in widget.series) {
      if (_hiddenRepoIds.contains(s.repoId)) continue;
      for (final d in s.data) {
        if (d.value < minY) minY = d.value;
        if (d.value > maxY) maxY = d.value;
      }
    }

    if (minY == double.infinity) {
      minY = 0;
      maxY = 10;
    }

    final range = maxY - minY;
    final double chartMinY = minY > 0 ? 0.0 : minY - (range * 0.1);
    final double chartMaxY = maxY + (range * 0.1);

    // Build line data for each visible series
    final lineBarsData = <LineChartBarData>[];
    for (final s in widget.series) {
      if (_hiddenRepoIds.contains(s.repoId)) continue;

      final spots = <FlSpot>[];
      for (final d in s.data) {
        final idx = periodIndex[d.period];
        if (idx != null) {
          spots.add(FlSpot(idx.toDouble(), d.value));
        }
      }
      spots.sort((a, b) => a.x.compareTo(b.x));

      if (spots.isNotEmpty) {
        lineBarsData.add(
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.3,
            color: s.color,
            barWidth: 2.5,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: sortedPeriods.length <= 12,
              getDotPainter: (spot, percent, barData, index) {
                return FlDotCirclePainter(
                  radius: 3,
                  color: Colors.white,
                  strokeWidth: 2,
                  strokeColor: s.color,
                );
              },
            ),
            belowBarData: BarAreaData(show: false),
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.title != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              widget.title!,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        SizedBox(
          height: widget.height,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: range > 0 ? range / 4 : 1,
                getDrawingHorizontalLine: (value) {
                  return FlLine(
                    color: Colors.grey.withValues(alpha: 0.2),
                    strokeWidth: 1,
                  );
                },
              ),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 45,
                    getTitlesWidget: (value, meta) {
                      final formatted = widget.valueFormatter != null
                          ? widget.valueFormatter!(value)
                          : value.toInt().toString();
                      return Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Text(
                          formatted,
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 11,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    interval: sortedPeriods.length > 6
                        ? (sortedPeriods.length / 4).ceil().toDouble()
                        : 1,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= sortedPeriods.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _formatLabel(sortedPeriods[index]),
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 10,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                topTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                rightTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
              ),
              borderData: FlBorderData(show: false),
              minX: 0,
              maxX: (sortedPeriods.length - 1).toDouble(),
              minY: chartMinY,
              maxY: chartMaxY,
              lineBarsData: lineBarsData,
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  fitInsideHorizontally: true,
                  fitInsideVertically: true,
                  getTooltipItems: (touchedSpots) {
                    return touchedSpots.map((spot) {
                      final seriesIndex = lineBarsData.indexOf(spot.bar);
                      final visibleSeries = widget.series
                          .where((s) => !_hiddenRepoIds.contains(s.repoId))
                          .toList();
                      if (seriesIndex >= 0 &&
                          seriesIndex < visibleSeries.length) {
                        final series = visibleSeries[seriesIndex];
                        final formatted = widget.valueFormatter != null
                            ? widget.valueFormatter!(spot.y)
                            : spot.y.toStringAsFixed(1);
                        return LineTooltipItem(
                          '${series.repoName}\n$formatted',
                          TextStyle(
                            color: series.color,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        );
                      }
                      return null;
                    }).toList();
                  },
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        // Legend
        _buildLegend(),
      ],
    );
  }

  Widget _buildLegend() {
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: widget.series.map((s) {
        final isHidden = _hiddenRepoIds.contains(s.repoId);
        return InkWell(
          onTap: () {
            setState(() {
              if (isHidden) {
                _hiddenRepoIds.remove(s.repoId);
              } else {
                // Don't allow hiding all series
                if (_hiddenRepoIds.length < widget.series.length - 1) {
                  _hiddenRepoIds.add(s.repoId);
                }
              }
            });
          },
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: isHidden ? Colors.grey[300] : s.color,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _shortenRepoName(s.repoName),
                  style: TextStyle(
                    fontSize: 12,
                    color: isHidden ? Colors.grey[400] : Colors.grey[700],
                    decoration:
                        isHidden ? TextDecoration.lineThrough : null,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  String _formatLabel(String label) {
    // Shorten labels like "2026-W04" to "W04" or "2026-01-23" to "01-23"
    if (label.contains('-W')) {
      return label.split('-').last;
    }
    if (label.length == 10) {
      // ISO date format
      return label.substring(5);
    }
    return label;
  }

  String _shortenRepoName(String name) {
    // If it's "org/repo", just show "repo"
    if (name.contains('/')) {
      return name.split('/').last;
    }
    return name;
  }
}
