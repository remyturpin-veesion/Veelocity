import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.js';

interface AuthGuardProps {
  children: React.ReactNode;
}

/** Redirects to /login if not authenticated. Use to wrap protected layout. */
export function AuthGuard({ children }: AuthGuardProps) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const isAuthenticated = Boolean(token);

  if (isAuthenticated) {
    return <>{children}</>;
  }
  return <Navigate to="/login" state={{ from: location }} replace />;
}
