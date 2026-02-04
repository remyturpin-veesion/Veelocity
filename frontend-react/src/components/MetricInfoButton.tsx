import { useState, useRef, useEffect } from 'react';

export type MetricKey =
  | 'deployment-frequency'
  | 'lead-time'
  | 'cycle-time'
  | 'throughput'
  | 'pr-review-time'
  | 'pr-merge-time'
  | 'pr-health'
  | 'reviewer-workload'
  | 'linear-backlog'
  | 'linear-issues-completed'
  | 'linear-time-in-state';

interface MetricExplanation {
  title: string;
  whyUseful: string;
  howCalculated: string;
  source: string;
}

const METRIC_EXPLANATIONS: Record<MetricKey, MetricExplanation> = {
  'deployment-frequency': {
    title: 'Deployment frequency',
    whyUseful:
      'One of the four DORA metrics. High deployment frequency indicates that your team can release changes quickly and with confidence. It correlates with faster feedback and lower risk per release.',
    howCalculated:
      'We count how many deployments occurred in the selected period. Deployments are detected from GitHub Actions workflow runs whose name or path matches configurable patterns (e.g. deploy, release, publish). The total and average per week are shown.',
    source: 'GitHub Actions (workflow runs)',
  },
  'lead-time': {
    title: 'Lead time for changes',
    whyUseful:
      'A DORA metric measuring how long it takes from the first commit to a change being deployed. Shorter lead time means ideas reach production faster and bottlenecks (e.g. long review or merge delays) are visible.',
    howCalculated:
      'For each deployment we find the first commit in that deployment and measure the time from that commit to the deployment. We then report the count of changes, and the average and median lead time in hours.',
    source: 'GitHub commits + GitHub Actions runs',
  },
  'cycle-time': {
    title: 'Cycle time',
    whyUseful:
      'Measures how long it takes from an issue being created to the linked PR being merged. It reflects end-to-end delivery speed from “idea” to “done” when using Linear for issues and GitHub for code.',
    howCalculated:
      'We consider Linear issues that are linked to a GitHub PR (via branch name or PR body). For each such issue we compute the time from issue creation to PR merge. The metric shows the number of issues and the average cycle time in hours.',
    source: 'Linear issues + GitHub PRs (via linking)',
  },
  throughput: {
    title: 'Throughput',
    whyUseful:
      'Simple count of merged PRs in a period. It gives a high-level view of delivery volume and helps compare trends over time or across repos.',
    howCalculated:
      'We count all pull requests merged in the selected date range (optionally filtered by repositories). The total and a trend of merged PRs over time are shown.',
    source: 'GitHub pull requests',
  },
  'pr-review-time': {
    title: 'PR review time',
    whyUseful:
      'Time from PR open to first review. Long review times can block progress and indicate bottlenecks; tracking this helps improve review responsiveness.',
    howCalculated:
      'For each PR we take the time of the first review (approval or comment) and subtract the PR opened time. We report the number of PRs and the average time in hours.',
    source: 'GitHub PRs and PR reviews',
  },
  'pr-merge-time': {
    title: 'PR merge time',
    whyUseful:
      'Time from PR open to merge. This reflects how quickly code moves from “ready for review” to “in main,” including review and any follow-up cycles.',
    howCalculated:
      'For each merged PR we compute the time from opened_at to merged_at. We report the count of PRs and the average merge time in hours.',
    source: 'GitHub pull requests',
  },
  'pr-health': {
    title: 'PR health',
    whyUseful:
      'A composite score for pull requests based on factors like review coverage, comment activity, and size. It helps identify PRs that might need attention or process improvements.',
    howCalculated:
      'Each PR is scored using factors such as number of reviews, comments, and size. The score is normalized; you see the number of PRs scored and the average score, plus a list of PRs with their health score and category.',
    source: 'GitHub PRs, reviews, and comments',
  },
  'reviewer-workload': {
    title: 'Reviewer workload',
    whyUseful:
      'Shows how review effort is distributed across team members. Balanced workload avoids burnout and bottlenecks; the Gini coefficient indicates inequality in distribution.',
    howCalculated:
      'We count how many reviews each person performed in the period and compute their share of total reviews. The Gini coefficient (0 = perfectly equal, 1 = one person does all) summarizes distribution inequality.',
    source: 'GitHub PR reviews',
  },
  'linear-backlog': {
    title: 'Linear backlog',
    whyUseful:
      'Snapshot of open issues. A growing backlog may indicate capacity issues or scope creep; tracking it helps with planning and prioritization.',
    howCalculated:
      'We count Linear issues that are not in a “done” or “canceled” state (or your workspace’s equivalent). The total and a breakdown by team are shown.',
    source: 'Linear issues',
  },
  'linear-issues-completed': {
    title: 'Linear issues completed',
    whyUseful:
      'Number of issues completed in a period. Complements throughput (merged PRs) by showing delivery from the product/issue perspective.',
    howCalculated:
      'We count Linear issues that were moved to a completed state within the selected date range. The total and a trend over time are shown.',
    source: 'Linear issues (state transitions)',
  },
  'linear-time-in-state': {
    title: 'Linear time in state',
    whyUseful:
      'Shows how long issues spend in each workflow stage (e.g. In progress, In review). Long times in a state can reveal bottlenecks in your process.',
    howCalculated:
      'For each workflow state we compute the total time issues spent in that state and the average per issue. You can filter by stages to focus on specific parts of the flow. Data is aggregated over the selected period.',
    source: 'Linear issues (state history)',
  },
};

interface MetricInfoButtonProps {
  metricKey: MetricKey;
}

export function MetricInfoButton({ metricKey }: MetricInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const explanation = METRIC_EXPLANATIONS[metricKey];
  if (!explanation) return null;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="metric-info-button"
        onClick={() => setOpen(true)}
        title={`About ${explanation.title}`}
        aria-label={`Learn more about ${explanation.title}`}
      >
        i
      </button>
      {open && (
        <div className="metric-info-modal-backdrop" role="dialog" aria-modal="true" aria-label={explanation.title}>
          <div className="metric-info-modal" ref={panelRef}>
            <div className="metric-info-modal__header">
              <h2 className="metric-info-modal__title">{explanation.title}</h2>
              <button
                type="button"
                className="metric-info-modal__close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="metric-info-modal__body">
              <section className="metric-info-modal__section">
                <h3 className="metric-info-modal__section-title">Why is it useful?</h3>
                <p>{explanation.whyUseful}</p>
              </section>
              <section className="metric-info-modal__section">
                <h3 className="metric-info-modal__section-title">How is it calculated?</h3>
                <p>{explanation.howCalculated}</p>
              </section>
              <section className="metric-info-modal__section">
                <h3 className="metric-info-modal__section-title">Data source</h3>
                <p>{explanation.source}</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
