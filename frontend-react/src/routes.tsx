import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell.js';
import { DashboardScreen } from '@/screens/DashboardScreen.js';
import { TeamScreen } from '@/screens/TeamScreen.js';
import { DeveloperProfileScreen } from '@/screens/DeveloperProfileScreen.js';
import { GitHubOverviewScreen } from '@/screens/GitHubOverviewScreen.js';
import { LinearOverviewScreen } from '@/screens/LinearOverviewScreen.js';
import { CursorOverviewScreen } from '@/screens/CursorOverviewScreen.js';
import { GreptileOverviewScreen } from '@/screens/GreptileOverviewScreen.js';
import { DataCoverageScreen } from '@/screens/DataCoverageScreen.js';
import { AlertsOverviewScreen } from '@/screens/AlertsOverviewScreen.js';
import { PRDetailScreen } from '@/screens/PRDetailScreen.js';
import { RecommendationsScreen } from '@/screens/RecommendationsScreen.js';
import { CorrelationsScreen } from '@/screens/CorrelationsScreen.js';
import { DeploymentFrequencyScreen } from '@/screens/metrics/DeploymentFrequencyScreen.js';
import { LeadTimeScreen } from '@/screens/metrics/LeadTimeScreen.js';
import { ThroughputScreen } from '@/screens/metrics/ThroughputScreen.js';
import { PRReviewTimeScreen } from '@/screens/metrics/PRReviewTimeScreen.js';
import { PRMergeTimeScreen } from '@/screens/metrics/PRMergeTimeScreen.js';
import { CycleTimeScreen } from '@/screens/metrics/CycleTimeScreen.js';
import { PRHealthScreen } from '@/screens/metrics/PRHealthScreen.js';
import { ReviewerWorkloadScreen } from '@/screens/metrics/ReviewerWorkloadScreen.js';
import { LinearIssuesCompletedScreen } from '@/screens/metrics/LinearIssuesCompletedScreen.js';
import { LinearBacklogScreen } from '@/screens/metrics/LinearBacklogScreen.js';
import { LinearTimeInStateScreen } from '@/screens/metrics/LinearTimeInStateScreen.js';

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
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
      { path: 'team/developer/:login', element: <DeveloperProfileScreen /> },
      { path: 'github', element: <GitHubOverviewScreen /> },
      { path: 'linear', element: <LinearOverviewScreen /> },
      { path: 'cursor', element: <CursorOverviewScreen /> },
      { path: 'greptile', element: <GreptileOverviewScreen /> },
      { path: 'data-coverage', element: <DataCoverageScreen /> },
      { path: 'alerts', element: <AlertsOverviewScreen /> },
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
