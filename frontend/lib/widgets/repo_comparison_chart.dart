import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

/// Data for a single repository in the comparison chart.
class RepoComparisonData {
  final int repoId;
  final String repoName;
  final double value;
  final Color color;
  final String? formattedValue;

  RepoComparisonData({
    required this.repoId,
    required this.repoName,
    required this.value,
    required this.color,
    this.formattedValue,
  });
}

/// A horizontal bar chart comparing a metric across repositories.
class RepoComparisonChart extends StatelessWidget {
  final List<RepoComparisonData> data;
  final String? title;
  final String? valueLabel;
  final String Function(double value)? valueFormatter;

  const RepoComparisonChart({
    super.key,
    required this.data,
    this.title,
    this.valueLabel,
    this.valueFormatter,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: 100,
        child: Center(
          child: Text(
            'No data available',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ),
      );
    }

    // Sort by value descending
    final sortedData = List<RepoComparisonData>.from(data)
      ..sort((a, b) => b.value.compareTo(a.value));

    final maxValue = sortedData.first.value;
    final chartHeight = (sortedData.length * 50.0).clamp(100.0, 400.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              title!,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        SizedBox(
          height: chartHeight,
          child: BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: maxValue * 1.1,
              minY: 0,
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  fitInsideHorizontally: true,
                  getTooltipItem: (group, groupIndex, rod, rodIndex) {
                    final item = sortedData[groupIndex];
                    final formatted = item.formattedValue ??
                        (valueFormatter != null
                            ? valueFormatter!(item.value)
                            : item.value.toStringAsFixed(1));
                    return BarTooltipItem(
                      '${item.repoName}\n$formatted',
                      TextStyle(
                        color: item.color,
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  },
                ),
              ),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 120,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= sortedData.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(
                          _shortenRepoName(sortedData[index].repoName),
                          style: TextStyle(
                            color: Colors.grey[700],
                            fontSize: 12,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    },
                  ),
                ),
                bottomTitles: AxisTitles(
                  axisNameWidget: valueLabel != null
                      ? Text(
                          valueLabel!,
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 11,
                          ),
                        )
                      : null,
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    getTitlesWidget: (value, meta) {
                      final formatted = valueFormatter != null
                          ? valueFormatter!(value)
                          : value.toInt().toString();
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          formatted,
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
              gridData: FlGridData(
                show: true,
                drawVerticalLine: true,
                drawHorizontalLine: false,
                getDrawingVerticalLine: (value) {
                  return FlLine(
                    color: Colors.grey.withValues(alpha: 0.2),
                    strokeWidth: 1,
                  );
                },
              ),
              barGroups: sortedData.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;
                return BarChartGroupData(
                  x: index,
                  barRods: [
                    BarChartRodData(
                      toY: item.value,
                      color: item.color,
                      width: 24,
                      borderRadius: const BorderRadius.horizontal(
                        right: Radius.circular(4),
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
            swapAnimationDuration: const Duration(milliseconds: 250),
          ),
        ),
        const SizedBox(height: 16),
        // Summary row
        _buildSummaryRow(context, sortedData),
      ],
    );
  }

  Widget _buildSummaryRow(
      BuildContext context, List<RepoComparisonData> sortedData) {
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: sortedData.map((item) {
        final formatted = item.formattedValue ??
            (valueFormatter != null
                ? valueFormatter!(item.value)
                : item.value.toStringAsFixed(1));
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: item.color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: item.color.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: item.color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                _shortenRepoName(item.repoName),
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatted,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: item.color,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  String _shortenRepoName(String name) {
    if (name.contains('/')) {
      return name.split('/').last;
    }
    return name;
  }
}
