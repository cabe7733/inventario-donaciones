import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCenter?: boolean;
}

export function ProtectedRoute({ children, requireCenter = true }: ProtectedRouteProps) {
  const { user, centerId, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requireCenter && !centerId) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
