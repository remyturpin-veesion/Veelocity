import 'package:flutter/material.dart';
import '../models/sync_coverage.dart';

/// Card displaying sync coverage data for repositories.
class DataCoverageCard extends StatelessWidget {
  final SyncCoverage coverage;
  final VoidCallback? onRefresh;

  const DataCoverageCard({
    super.key,
    required this.coverage,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Connector status
            _buildConnectorStatus(context),
            const SizedBox(height: 16),

            // Totals summary
            _buildTotalsSummary(context),
            const SizedBox(height: 16),

            // Repository table
            _buildRepositoryTable(context),
          ],
        ),
      ),
    );
  }

  Widget _buildConnectorStatus(BuildContext context) {
    if (coverage.connectors.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.orange.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.orange, size: 20),
            SizedBox(width: 8),
            Text('No connectors configured'),
          ],
        ),
      );
    }

    return Wrap(
      spacing: 12,
      runSpacing: 8,
      children: coverage.connectors.map((c) {
        final color = c.isRecent ? Colors.green : Colors.orange;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                c.isRecent ? Icons.check_circle : Icons.schedule,
                color: color,
                size: 16,
              ),
              const SizedBox(width: 6),
              Text(
                c.connectorName,
                style: TextStyle(
                  color: color.shade700,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                c.timeSinceSync,
                style: TextStyle(
                  color: color.shade700,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTotalsSummary(BuildContext context) {
    return Row(
      children: [
        _buildTotalChip(
          context,
          Icons.merge,
          '${coverage.totalPullRequests} PRs',
          Colors.purple,
        ),
        const SizedBox(width: 12),
        _buildTotalChip(
          context,
          Icons.commit,
          '${coverage.totalCommits} Commits',
          Colors.blue,
        ),
        const SizedBox(width: 12),
        _buildTotalChip(
          context,
          Icons.play_arrow,
          '${coverage.totalWorkflowRuns} Runs',
          Colors.green,
        ),
      ],
    );
  }

  Widget _buildTotalChip(
    BuildContext context,
    IconData icon,
    String label,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRepositoryTable(BuildContext context) {
    if (coverage.repositories.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        alignment: Alignment.center,
        child: Column(
          children: [
            Icon(Icons.folder_off, size: 48, color: Colors.grey[400]),
            const SizedBox(height: 8),
            Text(
              'No repositories synced yet',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: WidgetStateProperty.all(
          Colors.grey.withValues(alpha: 0.1),
        ),
        columns: const [
          DataColumn(label: Text('Repository')),
          DataColumn(label: Text('PRs'), numeric: true),
          DataColumn(label: Text('Commits'), numeric: true),
          DataColumn(label: Text('Runs'), numeric: true),
          DataColumn(label: Text('PR Date Range')),
          DataColumn(label: Text('Status')),
        ],
        rows: coverage.repositories.map((repo) {
          return DataRow(
            cells: [
              DataCell(
                Text(
                  repo.name,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
              ),
              DataCell(Text('${repo.pullRequests}')),
              DataCell(Text('${repo.commits}')),
              DataCell(Text('${repo.workflowRuns}')),
              DataCell(
                Text(
                  repo.prDateRange,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ),
              DataCell(_buildStatusIndicator(repo)),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildStatusIndicator(RepositoryCoverage repo) {
    switch (repo.status) {
      case SyncStatus.noData:
        return _statusChip('No data', Colors.grey, Icons.remove_circle_outline);
      case SyncStatus.incomplete:
        final pct = repo.completionPercent.toStringAsFixed(0);
        return _statusChip(
          '$pct% (${repo.prsWithoutDetails} left)',
          Colors.blue,
          Icons.sync,
        );
      case SyncStatus.stale:
        return _statusChip('Stale', Colors.orange, Icons.warning_amber);
      case SyncStatus.upToDate:
        return _statusChip('Up to date', Colors.green, Icons.check_circle);
    }
  }

  Widget _statusChip(String label, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

extension on Color {
  Color get shade700 {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness - 0.2).clamp(0.0, 1.0)).toColor();
  }
}
