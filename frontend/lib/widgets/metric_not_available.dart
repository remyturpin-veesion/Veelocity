import 'package:flutter/material.dart';

/// Widget displaying a message when a metric is not available.
/// Takes full width and has consistent height with other chart sections.
class MetricNotAvailable extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;

  const MetricNotAvailable({
    super.key,
    this.title = 'Metric Not Available Per Developer',
    this.description =
        'This metric measures team-level events and cannot be broken down by individual developers.',
    this.icon = Icons.info_outline,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 280, // Same height as charts
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 64,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 20),
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                description,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.grey[600],
                      height: 1.5,
                    ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
