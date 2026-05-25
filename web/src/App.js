import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import { AdminRoute } from './shared/routes/AdminRoute';
import { ProtectedRoute } from './shared/routes/ProtectedRoute';
import { RoleProtectedRoute } from './shared/routes/RoleProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage';
import UserManagementPage from './features/users/pages/UserManagementPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import ActivitiesListPage from './features/activities/pages/ActivitiesListPage';
import CreateActivityPage from './features/activities/pages/CreateActivityPage';
import ActivityDetailPage from './features/activities/pages/ActivityDetailPage';
import EditActivityPage from './features/activities/pages/EditActivityPage';
import { ACTIVITY_WRITE_ROLES } from './features/activities/constants';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Admin only */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagementPage />
              </AdminRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/activities"
            element={
              <ProtectedRoute>
                <ActivitiesListPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/activities/new"
            element={
              <RoleProtectedRoute allowedRoles={ACTIVITY_WRITE_ROLES}>
                <CreateActivityPage />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/activities/:id/edit"
            element={
              <RoleProtectedRoute allowedRoles={ACTIVITY_WRITE_ROLES}>
                <EditActivityPage />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/activities/:id"
            element={
              <ProtectedRoute>
                <ActivityDetailPage />
              </ProtectedRoute>
            }
          />

          <Route path="/access-denied" element={<div style={{ padding: 40 }}>Access Denied</div>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
