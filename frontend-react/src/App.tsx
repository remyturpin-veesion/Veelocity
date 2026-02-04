import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes.js';
import { useThemeStore } from './stores/theme.js';

// Clear GitHub OAuth error param from URL on load so failed attempts don't leave error in URL
function useClearOAuthErrorParam() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('github_oauth_error')) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', clean);
    }
  }, []);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, retry: 1 },
  },
});

function ThemeInit() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', useThemeStore.getState().theme);
  }, []);
  return null;
}

function App() {
  useClearOAuthErrorParam();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInit />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
