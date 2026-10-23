import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants/roles';

// Any signed-in staff account. Accreditor accounts never see the staff workspace -
// they are sent to their own list of assigned evidence links instead.
export function ProtectedRoute({ children }) {
  const { user, loading, loggedOut } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location }} />;

  if (user.mustChangePw) return <Navigate to="/change-password" replace />;

  if (user.role === ROLES.ACCREDITOR_LINK) return <Navigate to="/accreditor" replace />;

  return children;
}
