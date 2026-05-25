import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RoleProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (user.mustChangePw) return <Navigate to="/change-password" replace />;

  if (!allowedRoles.includes(user.role)) return <Navigate to="/access-denied" replace />;

  return children;
}
