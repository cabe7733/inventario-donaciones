import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { ModuleId, PermissionAction } from '../../lib/permissions';

interface PermissionGuardProps {
  module: ModuleId;
  action?: PermissionAction;
  children: ReactNode;
}

export function PermissionGuard({ module, action = 'view', children }: PermissionGuardProps) {
  const { hasPermission, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!hasPermission(module, action)) {
    return <Navigate to="/inicio" replace />;
  }

  return <>{children}</>;
}
