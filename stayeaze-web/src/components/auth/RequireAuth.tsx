import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/stores/auth-store';
import { canAccess } from '@/lib/role-utils';

interface RequireAuthProps {
  module?: string;
  allowedRoles?: string[];
  children: React.ReactNode;
}

export function RequireAuth({ module, allowedRoles, children }: RequireAuthProps) {
  const { user, token } = useAuthStore();
  const location = useLocation();
  const storedToken = localStorage.getItem('stayeaze_token');

  if (!user || !token || !storedToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (module && !canAccess(user.role, module)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
