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

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role || '';
    const cleanRole = userRole.replace('ROLE_', '');
    const hasRole = allowedRoles.some((r) => r === userRole || r === cleanRole || `ROLE_${r}` === userRole);
    if (!hasRole) {
      return <Navigate to={cleanRole === 'TENANT' ? '/tenant/dashboard' : '/dashboard'} replace />;
    }
  }

  if (module && !canAccess(user.role || '', module)) {
    const userRole = user.role || '';
    const cleanRole = userRole.replace('ROLE_', '');
    return <Navigate to={cleanRole === 'TENANT' ? '/tenant/dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}
