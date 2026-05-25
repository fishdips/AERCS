import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants/roles';

export function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (user.mustChangePw) return <Navigate to="/change-password" replace />;

  // NOTE: When adding new roles that should access admin routes, update this check
  if (user.role !== ROLES.ADMIN) return <Navigate to="/access-denied" replace />;

  return children;
}
