import { Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from './AuthProvider';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!role || !roles.includes(role)) {
    return <Navigate to="/inicio" replace />;
  }

  return <>{children}</>;
}
