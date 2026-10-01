import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import { AdminRoute } from './shared/routes/AdminRoute';
import { ProtectedRoute } from './shared/routes/ProtectedRoute';
import { RoleProtectedRoute } from './shared/routes/RoleProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage';
import UserManagementPage from './features/users/pages/UserManagementPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import ActivitiesListPage from './features/activities/pages/ActivitiesListPage';
import CreateActivityPage from './features/activities/pages/CreateActivityPage';
import UploadEvidencePage from './features/activities/pages/UploadEvidencePage';
import AssignMetadataPage from './features/activities/pages/AssignMetadataPage';
import ActivityDetailPage from './features/activities/pages/ActivityDetailPage';
import EditActivityPage from './features/activities/pages/EditActivityPage';
import RepositoryPage from './features/repository/pages/RepositoryPage';
import SharedEvidencePage from './features/shared-evidence/pages/SharedEvidencePage';
import ReferenceEvidencePage from './features/shared-evidence/pages/ReferenceEvidencePage';
import EvidenceReferencesPage from './features/shared-evidence/pages/EvidenceReferencesPage';
import AccreditorLinksPage from './features/accreditor-access/pages/AccreditorLinksPage';
import AccreditorLinkDetailPage from './features/accreditor-access/pages/AccreditorLinkDetailPage';
import { ROLES } from './shared/constants/roles';
import { ACTIVITY_CREATE_ROLES, ACTIVITY_WRITE_ROLES } from './features/activities/constants';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          {/* Old public token links no longer grant access - accreditors sign in instead. */}
          <Route path="/accreditor-access/:token" element={<Navigate to="/accreditor" replace />} />
          <Route path="/a/:token" element={<Navigate to="/accreditor" replace />} />

          {/* Accreditor accounts: only the evidence links assigned to them */}
          <Route
            path="/accreditor"
            element={
              <RoleProtectedRoute allowedRoles={[ROLES.ACCREDITOR_LINK]}>
                <AccreditorLinksPage />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/accreditor/links/:id"
            element={
              <RoleProtectedRoute allowedRoles={[ROLES.ACCREDITOR_LINK]}>
                <AccreditorLinkDetailPage />
              </RoleProtectedRoute>
            }
          />

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
              <RoleProtectedRoute allowedRoles={ACTIVITY_CREATE_ROLES}>
                <CreateActivityPage />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/activities/:id/evidence"
            element={
              <RoleProtectedRoute allowedRoles={ACTIVITY_CREATE_ROLES}>
                <UploadEvidencePage />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/activities/:id/metadata"
            element={
              <RoleProtectedRoute allowedRoles={ACTIVITY_WRITE_ROLES}>
                <AssignMetadataPage />
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
