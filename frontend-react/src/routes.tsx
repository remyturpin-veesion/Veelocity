import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ShellLayout } from '@/components/ShellLayout.js';

// Lazy-load screens to reduce initial bundle and memory (helps avoid "Aw, Snap!" / Error code: 5)
const DashboardScreen = lazy(() => import('@/screens/DashboardScreen.js').then((m) => ({ default: m.DashboardScreen })));
const DoraScreen = lazy(() => import('@/screens/DoraScreen.js').then((m) => ({ default: m.DoraScreen })));
const DoraBenchmarksScreen = lazy(() => import('@/screens/DoraBenchmarksScreen.js').then((m) => ({ default: m.DoraBenchmarksScreen })));
const DoraMetricsScreen = lazy(() => import('@/screens/DoraMetricsScreen.js').then((m) => ({ default: m.DoraMetricsScreen })));
const TeamScreen = lazy(() => import('@/screens/TeamScreen.js').then((m) => ({ default: m.TeamScreen })));
const GitHubOverviewScreen = lazy(() => import('@/screens/GitHubOverviewScreen.js').then((m) => ({ default: m.GitHubOverviewScreen })));
const GitHubSyncedScreen = lazy(() => import('@/screens/GitHubSyncedScreen.js').then((m) => ({ default: m.GitHubSyncedScreen })));
const PullRequestScreen = lazy(() => import('@/screens/PullRequestScreen.js').then((m) => ({ default: m.PullRequestScreen })));
const CodeReviewPRsScreen = lazy(() => import('@/screens/CodeReviewPRsScreen.js').then((m) => ({ default: m.CodeReviewPRsScreen })));
const LinearOverviewScreen = lazy(() => import('@/screens/LinearOverviewScreen.js').then((m) => ({ default: m.LinearOverviewScreen })));
const CursorOverviewScreen = lazy(() => import('@/screens/CursorOverviewScreen.js').then((m) => ({ default: m.CursorOverviewScreen })));
const GreptileOverviewScreen = lazy(() => import('@/screens/GreptileOverviewScreen.js').then((m) => ({ default: m.GreptileOverviewScreen })));
const GreptileIndexingScreen = lazy(() => import('@/screens/GreptileIndexingScreen.js').then((m) => ({ default: m.GreptileIndexingScreen })));
const GreptileRecommendationsScreen = lazy(() => import('@/screens/GreptileRecommendationsScreen.js').then((m) => ({ default: m.GreptileRecommendationsScreen })));
const SentryOverviewScreen = lazy(() => import('@/screens/SentryOverviewScreen.js').then((m) => ({ default: m.SentryOverviewScreen })));
const SentryProjectsScreen = lazy(() => import('@/screens/SentryProjectsScreen.js').then((m) => ({ default: m.SentryProjectsScreen })));
const DataCoverageScreen = lazy(() => import('@/screens/DataCoverageScreen.js').then((m) => ({ default: m.DataCoverageScreen })));
const PRDetailScreen = lazy(() => import('@/screens/PRDetailScreen.js').then((m) => ({ default: m.PRDetailScreen })));
const RecommendationsScreen = lazy(() => import('@/screens/RecommendationsScreen.js').then((m) => ({ default: m.RecommendationsScreen })));
const CorrelationsScreen = lazy(() => import('@/screens/CorrelationsScreen.js').then((m) => ({ default: m.CorrelationsScreen })));
const DeploymentFrequencyScreen = lazy(() => import('@/screens/metrics/DeploymentFrequencyScreen.js').then((m) => ({ default: m.DeploymentFrequencyScreen })));
const LeadTimeScreen = lazy(() => import('@/screens/metrics/LeadTimeScreen.js').then((m) => ({ default: m.LeadTimeScreen })));
const ThroughputScreen = lazy(() => import('@/screens/metrics/ThroughputScreen.js').then((m) => ({ default: m.ThroughputScreen })));
const PRReviewTimeScreen = lazy(() => import('@/screens/metrics/PRReviewTimeScreen.js').then((m) => ({ default: m.PRReviewTimeScreen })));
const PRMergeTimeScreen = lazy(() => import('@/screens/metrics/PRMergeTimeScreen.js').then((m) => ({ default: m.PRMergeTimeScreen })));
const CycleTimeScreen = lazy(() => import('@/screens/metrics/CycleTimeScreen.js').then((m) => ({ default: m.CycleTimeScreen })));
const LinearIssuesCompletedScreen = lazy(() => import('@/screens/metrics/LinearIssuesCompletedScreen.js').then((m) => ({ default: m.LinearIssuesCompletedScreen })));
const LinearBacklogScreen = lazy(() => import('@/screens/metrics/LinearBacklogScreen.js').then((m) => ({ default: m.LinearBacklogScreen })));
const LinearTimeInStateScreen = lazy(() => import('@/screens/metrics/LinearTimeInStateScreen.js').then((m) => ({ default: m.LinearTimeInStateScreen })));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ShellLayout />,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: 'dora', element: <DoraScreen /> },
      { path: 'dora/benchmarks', element: <DoraBenchmarksScreen /> },
      { path: 'dora/metrics', element: <DoraMetricsScreen /> },
      { path: 'team', element: <TeamScreen /> },
      { path: 'github', element: <GitHubOverviewScreen /> },
      { path: 'github/synced', element: <GitHubSyncedScreen /> },
      { path: 'github/pull-request', element: <PullRequestScreen /> },
      { path: 'github/code-review/prs', element: <CodeReviewPRsScreen /> },
      { path: 'linear', element: <LinearOverviewScreen /> },
      { path: 'cursor', element: <CursorOverviewScreen /> },
      { path: 'greptile', element: <GreptileOverviewScreen /> },
      { path: 'greptile/indexing', element: <GreptileIndexingScreen /> },
      { path: 'greptile/recommendations', element: <GreptileRecommendationsScreen /> },
      { path: 'sentry', element: <SentryOverviewScreen /> },
      { path: 'sentry/projects', element: <SentryProjectsScreen /> },
      { path: 'data-coverage', element: <DataCoverageScreen /> },
      { path: 'metrics/deployment-frequency', element: <DeploymentFrequencyScreen /> },
      { path: 'metrics/lead-time', element: <LeadTimeScreen /> },
      { path: 'metrics/pr-review-time', element: <PRReviewTimeScreen /> },
      { path: 'metrics/pr-merge-time', element: <PRMergeTimeScreen /> },
      { path: 'metrics/cycle-time', element: <CycleTimeScreen /> },
      { path: 'metrics/throughput', element: <ThroughputScreen /> },
      { path: 'metrics/linear/issues-completed', element: <LinearIssuesCompletedScreen /> },
      { path: 'metrics/linear/backlog', element: <LinearBacklogScreen /> },
      { path: 'metrics/linear/time-in-state', element: <LinearTimeInStateScreen /> },
      { path: 'insights/recommendations', element: <RecommendationsScreen /> },
      { path: 'insights/correlations', element: <CorrelationsScreen /> },
      { path: 'pr/:id', element: <PRDetailScreen /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
