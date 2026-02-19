import type { Step } from 'react-joyride';

export interface TourGroup {
  route: string;
  steps: Step[];
}

/**
 * Tour is split into page-groups so Joyride only ever receives steps
 * whose targets exist on the current page — no cross-page issues.
 */
export const TOUR_GROUPS: TourGroup[] = [
  // ── Group 0: Dashboard ──
  {
    route: '/',
    steps: [
      {
        target: '[data-tour="nav-tabs"]',
        title: 'Navigation',
        content:
          'Use these tabs to switch between Dashboard, DORA, GitHub, Linear, Team, and Data Coverage views.',
        disableBeacon: true,
        placement: 'bottom',
      },
      {
        target: '[data-tour="global-filters"]',
        title: 'Global Filters',
        content:
          'Filter all metrics by repository and date range. Changes apply across every page.',
        disableBeacon: true,
        placement: 'bottom',
      },
      {
        target: '[data-tour="dashboard-kpis"]',
        title: 'DORA KPI Cards',
        content:
          'At-a-glance DORA metrics: deployment frequency, lead time, and more. Each card shows trend vs. the previous period.',
        disableBeacon: true,
        placement: 'bottom',
      },
      {
        target: '[data-tour="dashboard-flow-chart"]',
        title: 'Global Flow Chart',
        content:
          'Visualise how work flows from commits through PRs to deployments over time.',
        disableBeacon: true,
        placement: 'top',
      },
      {
        target: '[data-tour="dashboard-quick-overview"]',
        title: 'Quick Overview',
        content:
          'A snapshot of recent activity: open PRs, pending reviews, and recent deployments.',
        disableBeacon: true,
        placement: 'left',
      },
    ],
  },

  // ── Group 1: DORA ──
  {
    route: '/dora',
    steps: [
      {
        target: '[data-tour="dora-sidebar"]',
        title: 'DORA Section',
        content:
          'The DORA section provides detailed metrics on deployment frequency, lead time, and benchmark comparisons.',
        disableBeacon: true,
        placement: 'right',
      },
      {
        target: '[data-tour="dora-kpis"]',
        title: 'DORA KPIs & Tier Badges',
        content:
          'Each DORA metric shows your current tier (Elite, High, Medium, Low) based on industry benchmarks.',
        disableBeacon: true,
        placement: 'bottom',
      },
    ],
  },

  // ── Group 2: GitHub ──
  {
    route: '/github',
    steps: [
      {
        target: '[data-tour="github-sidebar"]',
        title: 'GitHub Section',
        content:
          'Explore GitHub metrics: DORA, code review, throughput, cycle time, and actionable insights.',
        disableBeacon: true,
        placement: 'right',
      },
      {
        target: '[data-tour="github-kpis"]',
        title: 'GitHub Metrics',
        content:
          'Key GitHub metrics at a glance: deployment frequency, lead time, and throughput with trend indicators.',
        disableBeacon: true,
        placement: 'bottom',
      },
    ],
  },

  // ── Group 3: Linear ──
  {
    route: '/linear',
    steps: [
      {
        target: '[data-tour="linear-sidebar"]',
        title: 'Linear Section',
        content:
          'Track Linear issues: completed work, backlog health, and time-in-state analysis.',
        disableBeacon: true,
        placement: 'right',
      },
      {
        target: '[data-tour="linear-kpis"]',
        title: 'Linear Metrics',
        content:
          'Issues completed, backlog size, and average time in each state across your Linear teams.',
        disableBeacon: true,
        placement: 'bottom',
      },
    ],
  },

  // ── Group 4: Team ──
  {
    route: '/team',
    steps: [
      {
        target: '[data-tour="team-list"]',
        title: 'Team View',
        content:
          'See per-developer stats: PRs merged, reviews given, and individual performance trends.',
        disableBeacon: true,
        placement: 'bottom',
      },
    ],
  },

  // ── Group 5: Back to Dashboard for Settings & Tour button ──
  {
    route: '/',
    steps: [
      {
        target: '[data-tour="settings-button"]',
        title: 'Settings',
        content:
          'Configure your GitHub and Linear API keys, repository list, and other integrations here.',
        disableBeacon: true,
        placement: 'bottom',
      },
      {
        target: '[data-tour="tour-button"]',
        title: 'Restart Tour Anytime',
        content:
          'Click this button whenever you want to replay the guided tour. Enjoy Veelocity!',
        disableBeacon: true,
        placement: 'bottom',
      },
    ],
  },
];

/** Total steps across all groups — used for global progress display. */
export const TOTAL_TOUR_STEPS = TOUR_GROUPS.reduce((acc, g) => acc + g.steps.length, 0);

/** Step offset of a group: sum of all previous groups' step counts. */
export function getGroupOffset(groupIndex: number): number {
  return TOUR_GROUPS.slice(0, groupIndex).reduce((acc, g) => acc + g.steps.length, 0);
}
