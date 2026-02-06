import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell.js';

// Lazy-load screens to reduce initial bundle and memory (helps avoid "Aw, Snap!" / Error code: 5)
const DashboardScreen = lazy(() => import('@/screens/DashboardScreen.js').then((m) => ({ default: m.DashboardScreen })));
const TeamScreen = lazy(() => import('@/screens/TeamScreen.js').then((m) => ({ default: m.TeamScreen })));
const GitHubOverviewScreen = lazy(() => import('@/screens/GitHubOverviewScreen.js').then((m) => ({ default: m.GitHubOverviewScreen })));
const PullRequestScreen = lazy(() => import('@/screens/PullRequestScreen.js').then((m) => ({ default: m.PullRequestScreen })));
const CodeReviewPRsScreen = lazy(() => import('@/screens/CodeReviewPRsScreen.js').then((m) => ({ default: m.CodeReviewPRsScreen })));
const LinearOverviewScreen = lazy(() => import('@/screens/LinearOverviewScreen.js').then((m) => ({ default: m.LinearOverviewScreen })));
const CursorOverviewScreen = lazy(() => import('@/screens/CursorOverviewScreen.js').then((m) => ({ default: m.CursorOverviewScreen })));
const GreptileOverviewScreen = lazy(() => import('@/screens/GreptileOverviewScreen.js').then((m) => ({ default: m.GreptileOverviewScreen })));
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
const PRHealthScreen = lazy(() => import('@/screens/metrics/PRHealthScreen.js').then((m) => ({ default: m.PRHealthScreen })));
const ReviewerWorkloadScreen = lazy(() => import('@/screens/metrics/ReviewerWorkloadScreen.js').then((m) => ({ default: m.ReviewerWorkloadScreen })));
const LinearIssuesCompletedScreen = lazy(() => import('@/screens/metrics/LinearIssuesCompletedScreen.js').then((m) => ({ default: m.LinearIssuesCompletedScreen })));
const LinearBacklogScreen = lazy(() => import('@/screens/metrics/LinearBacklogScreen.js').then((m) => ({ default: m.LinearBacklogScreen })));
const LinearTimeInStateScreen = lazy(() => import('@/screens/metrics/LinearTimeInStateScreen.js').then((m) => ({ default: m.LinearTimeInStateScreen })));

function ShellLayout() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              color: 'var(--color-text-muted, #94a3b8)',
            }}
          >
            Loading…
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ShellLayout />,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: 'team', element: <TeamScreen /> },
      { path: 'github', element: <GitHubOverviewScreen /> },
      { path: 'github/pull-request', element: <PullRequestScreen /> },
      { path: 'github/code-review/prs', element: <CodeReviewPRsScreen /> },
      { path: 'linear', element: <LinearOverviewScreen /> },
      { path: 'cursor', element: <CursorOverviewScreen /> },
      { path: 'greptile', element: <GreptileOverviewScreen /> },
      { path: 'data-coverage', element: <DataCoverageScreen /> },
      { path: 'metrics/deployment-frequency', element: <DeploymentFrequencyScreen /> },
      { path: 'metrics/lead-time', element: <LeadTimeScreen /> },
      { path: 'metrics/pr-review-time', element: <PRReviewTimeScreen /> },
      { path: 'metrics/pr-merge-time', element: <PRMergeTimeScreen /> },
      { path: 'metrics/cycle-time', element: <CycleTimeScreen /> },
      { path: 'metrics/throughput', element: <ThroughputScreen /> },
      { path: 'metrics/pr-health', element: <PRHealthScreen /> },
      { path: 'metrics/reviewer-workload', element: <ReviewerWorkloadScreen /> },
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

export function useIsActive(path: string): boolean {
  const loc = useLocation();
  if (path === '/') return loc.pathname === '/' || loc.pathname === '/dashboard';
  return loc.pathname === path || loc.pathname.startsWith(path + '/');
}
