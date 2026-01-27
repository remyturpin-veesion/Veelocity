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

/// A line chart with dots comparing a metric across repositories.
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

    // Calculate median from individual repositories (excluding "All Repositories" with repoId=0)
    final individualRepos = data.where((d) => d.repoId != 0).toList();
    double? medianValue;
    if (individualRepos.isNotEmpty) {
      final values = individualRepos.map((d) => d.value).toList()..sort();
      medianValue = values.length % 2 == 0
          ? (values[values.length ~/ 2 - 1] + values[values.length ~/ 2]) / 2
          : values[values.length ~/ 2];
    }

    // Sort by value descending
    final sortedData = List<RepoComparisonData>.from(data)
      ..sort((a, b) => b.value.compareTo(a.value));

    final maxValue = sortedData.first.value;
    final chartHeight = 250.0;

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
          child: LineChart(
            LineChartData(
              minY: 0,
              maxY: maxValue * 1.15,
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  getTooltipItems: (touchedSpots) {
                    return touchedSpots.map((spot) {
                      final item = sortedData[spot.x.toInt()];
                      final formatted = item.formattedValue ??
                          (valueFormatter != null
                              ? valueFormatter!(item.value)
                              : item.value.toStringAsFixed(1));
                      return LineTooltipItem(
                        '${item.repoName}\n$formatted',
                        const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      );
                    }).toList();
                  },
                ),
              ),
              titlesData: FlTitlesData(
                show: true,
                rightTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                topTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 60,
                    interval: 1,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= sortedData.length) {
                        return const SizedBox.shrink();
                      }
                      final item = sortedData[index];
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: RotatedBox(
                          quarterTurns: -1,
                          child: Text(
                            _shortenRepoName(item.repoName),
                            style: TextStyle(
                              color: item.color,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                            textAlign: TextAlign.left,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  axisNameWidget: valueLabel != null
                      ? Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            valueLabel!,
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 11,
                            ),
                          ),
                        )
                      : null,
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 60,
                    getTitlesWidget: (value, meta) {
                      if (valueFormatter != null) {
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Text(
                            valueFormatter!(value),
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 10,
                            ),
                          ),
                        );
                      }
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(
                          value.toInt().toString(),
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 10,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              gridData: FlGridData(
                show: true,
                drawVerticalLine: true,
                getDrawingHorizontalLine: (value) {
                  return FlLine(
                    color: Colors.grey.withValues(alpha: 0.1),
                    strokeWidth: 1,
                  );
                },
                getDrawingVerticalLine: (value) {
                  return FlLine(
                    color: Colors.grey.withValues(alpha: 0.1),
                    strokeWidth: 1,
                  );
                },
              ),
              borderData: FlBorderData(
                show: true,
                border: Border.all(
                  color: Colors.grey.withValues(alpha: 0.2),
                ),
              ),
              extraLinesData: medianValue != null
                  ? ExtraLinesData(
                      horizontalLines: [
                        HorizontalLine(
                          y: medianValue,
                          color: Colors.grey[700]!,
                          strokeWidth: 2,
                          dashArray: [5, 5],
                          label: HorizontalLineLabel(
                            show: true,
                            alignment: Alignment.topLeft,
                            padding: const EdgeInsets.only(left: 4, bottom: 4),
                            style: TextStyle(
                              color: Colors.grey[700],
                              fontSize: 10,
                              fontStyle: FontStyle.italic,
                            ),
                            labelResolver: (line) => 'Median',
                          ),
                        ),
                      ],
                    )
                  : null,
              lineBarsData: [
                LineChartBarData(
                  spots: sortedData
                      .asMap()
                      .entries
                      .map((e) => FlSpot(e.key.toDouble(), e.value.value))
                      .toList(),
                  isCurved: false,
                  color: Colors.grey[600],
                  barWidth: 3,
                  isStrokeCapRound: true,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, percent, barData, index) {
                      return FlDotCirclePainter(
                        radius: 6,
                        color: sortedData[index].color,
                        strokeWidth: 2,
                        strokeColor: Colors.white,
                      );
                    },
                  ),
                  belowBarData: BarAreaData(show: false),
                ),
              ],
            ),
            duration: const Duration(milliseconds: 250),
          ),
        ),
        const SizedBox(height: 16),
        // Summary row
        _buildSummaryRow(context, sortedData, medianValue),
      ],
    );
  }

  Widget _buildSummaryRow(BuildContext context,
      List<RepoComparisonData> sortedData, double? medianValue) {
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        ...sortedData.map((item) {
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
        }),
        // Add median chip
        if (medianValue != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 16,
                  height: 2,
                  decoration: BoxDecoration(
                    color: Colors.grey[700],
                  ),
                  child: CustomPaint(
                    painter: _DashedLinePainter(color: Colors.grey[700]!),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'Median (repos only)',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[700],
                    fontStyle: FontStyle.italic,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  valueFormatter != null
                      ? valueFormatter!(medianValue)
                      : medianValue.toStringAsFixed(1),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  String _shortenRepoName(String name) {
    if (name.contains('/')) {
      return name.split('/').last;
    }
    return name;
  }
}

/// Custom painter for dashed line in legend.
class _DashedLinePainter extends CustomPainter {
  final Color color;

  _DashedLinePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    const dashWidth = 3.0;
    const dashSpace = 3.0;
    double startX = 0;

    while (startX < size.width) {
      canvas.drawLine(
        Offset(startX, size.height / 2),
        Offset(startX + dashWidth, size.height / 2),
        paint,
      );
      startX += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
