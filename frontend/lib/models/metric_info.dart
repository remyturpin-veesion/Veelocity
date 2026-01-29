import 'package:flutter/material.dart';

/// Static metadata about a metric including description, calculation, and tips.
class MetricInfo {
  final String id;
  final String name;
  final String description;
  final String calculation;
  final String unit;
  final List<String> tips;
  final IconData icon;
  final Color color;

  const MetricInfo({
    required this.id,
    required this.name,
    required this.description,
    required this.calculation,
    required this.unit,
    required this.tips,
    required this.icon,
    required this.color,
  });

  /// All metric definitions.
  static const Map<String, MetricInfo> all = {
    'deployment_frequency': deploymentFrequency,
    'lead_time': leadTime,
    'pr_review_time': prReviewTime,
    'pr_merge_time': prMergeTime,
    'cycle_time': cycleTime,
    'throughput': throughput,
    'pr_health': prHealth,
    'reviewer_workload': reviewerWorkload,
    'recommendations': recommendations,
  };

  static const deploymentFrequency = MetricInfo(
    id: 'deployment_frequency',
    name: 'Deployment Frequency',
    description:
        'Measures how often your team deploys code to production. This is a key DORA metric that indicates the pace of your delivery pipeline. Higher deployment frequency typically correlates with smaller, safer changes and faster feedback loops.',
    calculation:
        'Count of successful deployment workflow runs divided by the time period. A deployment is identified by GitHub Actions workflows matching the configured deployment patterns (e.g., "deploy", "release", "production").',
    unit: 'deployments per week',
    tips: [
      'Aim for multiple deployments per day for elite performance',
      'Smaller, more frequent deployments reduce risk',
      'Automate your deployment pipeline to increase frequency',
      'Use feature flags to decouple deployment from release',
    ],
    icon: Icons.rocket_launch,
    color: Colors.blue,
  );

  static const leadTime = MetricInfo(
    id: 'lead_time',
    name: 'Lead Time for Changes',
    description:
        'Measures the time from the first commit on a PR to when that code is deployed to production. This DORA metric shows how quickly your team can deliver value to users. Lower lead time means faster feedback and quicker iteration.',
    calculation:
        'For each deployment, find the PR containing the deployed commit. Calculate the time from the first commit on that PR to the deployment completion. Report average and median across all deployments.',
    unit: 'hours',
    tips: [
      'Elite teams have lead time under 1 hour',
      'Reduce PR size to speed up reviews and merging',
      'Automate testing to remove manual bottlenecks',
      'Use trunk-based development for faster integration',
    ],
    icon: Icons.timer,
    color: Colors.green,
  );

  static const prReviewTime = MetricInfo(
    id: 'pr_review_time',
    name: 'PR Review Time',
    description:
        'Measures the time from when a pull request is opened to when it receives its first review. This metric indicates team collaboration and code review responsiveness. Lower review time helps maintain developer flow and prevents context switching.',
    calculation:
        'For each PR, calculate the time between PR creation and the first review submission. Report average and median across all reviewed PRs in the period.',
    unit: 'hours',
    tips: [
      'Set team expectations for review response time (e.g., 4 hours)',
      'Use code owners to route PRs to the right reviewers',
      'Keep PRs small (<400 lines) for faster reviews',
      'Consider async code review tools for distributed teams',
    ],
    icon: Icons.rate_review,
    color: Colors.orange,
  );

  static const prMergeTime = MetricInfo(
    id: 'pr_merge_time',
    name: 'PR Merge Time',
    description:
        'Measures the total time from when a pull request is opened to when it is merged. This end-to-end metric captures the full lifecycle of a code change through the review process. Lower merge time indicates efficient code review and integration practices.',
    calculation:
        'For each merged PR, calculate the time between PR creation (created_at) and merge (merged_at). Report average and median across all merged PRs in the period.',
    unit: 'hours',
    tips: [
      'Target merge time under 24 hours for most PRs',
      'Address review comments promptly to avoid stale PRs',
      'Use draft PRs for work-in-progress to avoid premature reviews',
      'Automate CI checks to speed up the merge process',
    ],
    icon: Icons.merge,
    color: Colors.purple,
  );

  static const cycleTime = MetricInfo(
    id: 'cycle_time',
    name: 'Cycle Time',
    description:
        'Measures the time from when work starts on an issue to when the linked PR is merged. This metric shows how long it takes to complete a unit of work. Requires Linear integration to track issue start times and PR linking.',
    calculation:
        'For each Linear issue with a linked PR, calculate the time from issue started_at to PR merged_at. Report average and median across all completed issues in the period.',
    unit: 'hours',
    tips: [
      'Break large issues into smaller, shippable units',
      'Link PRs to issues for accurate tracking',
      'Identify and address blockers quickly',
      'Use WIP limits to focus on finishing work',
    ],
    icon: Icons.loop,
    color: Colors.teal,
  );

  static const throughput = MetricInfo(
    id: 'throughput',
    name: 'Throughput',
    description:
        'Measures the number of pull requests merged per time period. This is a simple but powerful metric showing your team\'s output velocity. Consistent throughput indicates a healthy, predictable delivery process.',
    calculation:
        'Count of PRs merged in each period (day, week, or month). Total and average are calculated across the selected date range.',
    unit: 'PRs per week',
    tips: [
      'Track throughput trends rather than absolute numbers',
      'Combine with quality metrics to ensure output is valuable',
      'Use throughput to identify capacity constraints',
      'Celebrate consistent delivery over heroic bursts',
    ],
    icon: Icons.speed,
    color: Colors.indigo,
  );

  static const prHealth = MetricInfo(
    id: 'pr_health',
    name: 'PR Health',
    description:
        'Scores each pull request (0–100) based on review rounds, comment volume, PR size, time to first review, and time to merge. Helps identify PRs that need attention and track overall review health.',
    calculation:
        'Four components (review, comment, size, time) each contribute 0–25 points. Categories: excellent (80+), good (60–79), fair (40–59), poor (<40).',
    unit: 'score (0–100)',
    tips: [
      'Target excellent or good scores for most PRs',
      'Address poor scores by reducing review rounds and PR size',
      'Use filters to find PRs by author or repository',
      'Combine with reviewer workload to balance review capacity',
    ],
    icon: Icons.health_and_safety,
    color: Colors.red,
  );

  static const reviewerWorkload = MetricInfo(
    id: 'reviewer_workload',
    name: 'Reviewer Workload',
    description:
        'Analyzes how code reviews are distributed across reviewers. Identifies bottlenecks (reviewers handling >40% of reviews) and under-utilized reviewers (<10% when team has 3+ reviewers).',
    calculation:
        'Review count per reviewer in the period. Gini coefficient measures inequality (0 = equal, 1 = one person does all). Bottleneck: >40% of reviews. Under-utilized: <10% when 3+ reviewers.',
    unit: 'reviews',
    tips: [
      'Aim for Gini coefficient below 0.5 to avoid burnout',
      'Balance workload by involving under-utilized reviewers',
      'Use code owners to spread review responsibility',
      'Monitor bottlenecks to prevent single points of failure',
    ],
    icon: Icons.people,
    color: Colors.amber,
  );

  static const recommendations = MetricInfo(
    id: 'recommendations',
    name: 'Recommendations',
    description:
        'Prioritized, data-driven recommendations to improve deployment frequency, lead time, review time, PR size, and reviewer balance.',
    calculation:
        'Rule-based engine: deployment frequency <1/week, lead time >48h, review time >12h, large PRs, reviewer bottleneck.',
    unit: '—',
    tips: [
      'Address high-priority items first',
      'Use metric context to track progress',
      'Re-run after changes to see updated recommendations',
    ],
    icon: Icons.lightbulb_outline,
    color: Colors.amber,
  );
}
