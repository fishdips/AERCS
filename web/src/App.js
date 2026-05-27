import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import { AdminRoute } from './shared/routes/AdminRoute';
import { ProtectedRoute } from './shared/routes/ProtectedRoute';
import { RoleProtectedRoute } from './shared/routes/RoleProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage';
import UserManagementPage from './features/users/pages/UserManagementPage';
import ActivitiesListPage from './features/activities/pages/ActivitiesListPage';
import CreateActivityPage from './features/activities/pages/CreateActivityPage';
import ActivityDetailPage from './features/activities/pages/ActivityDetailPage';
import EditActivityPage from './features/activities/pages/EditActivityPage';
import RepositoryPage from './features/repository/pages/RepositoryPage';
import SharedEvidencePage from './features/shared-evidence/pages/SharedEvidencePage';
import ReferenceEvidencePage from './features/shared-evidence/pages/ReferenceEvidencePage';
import EvidenceReferencesPage from './features/shared-evidence/pages/EvidenceReferencesPage';
import AccreditorAccessPage from './features/accreditor-access/pages/AccreditorAccessPage';
import { ACTIVITY_WRITE_ROLES } from './features/activities/constants';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/accreditor-access/:token" element={<AccreditorAccessPage />} />

          {/* Admin only */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagementPage />
              </AdminRoute>
            }
          />

          <Route path="/dashboard" element={<Navigate to="/activities" replace />} />

          <Route
            path="/repository"
            element={
              <ProtectedRoute>
                <RepositoryPage />
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

          {/* Shared Evidence */}
          <Route
            path="/shared-evidence"
            element={
              <ProtectedRoute>
                <SharedEvidencePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/shared-evidence/:evidenceId/references"
            element={
              <ProtectedRoute>
                <EvidenceReferencesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/activities/:activityId/reference-evidence"
            element={
              <ProtectedRoute>
                <ReferenceEvidencePage />
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
