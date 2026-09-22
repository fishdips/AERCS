import api from '../../shared/api/config';

export const createUser = (data) =>
  api.post('/api/admin/users', data);

export const createUsersBatch = (data) =>
  api.post('/api/admin/users/batch', data);

export const listUsers = () =>
  api.get('/api/admin/users');

export const updateUserRole = (userId, role) =>
  api.patch(`/api/admin/users/${userId}/role`, { role });

export const updateUserStatus = (userId, active) =>
  api.patch(`/api/admin/users/${userId}/status`, { active });

export const updateUserOffice = (userId, office) =>
  api.patch(`/api/admin/users/${userId}/office`, { office: office || null });

export const updateUserProfile = (userId, name, email) =>
  api.patch(`/api/admin/users/${userId}/profile`, { name, email });

export const resetUserPassword = (userId) =>
  api.post(`/api/admin/users/${userId}/reset-password`);

export const revokeUserSessions = (userId) =>
  api.post(`/api/admin/users/${userId}/revoke-sessions`);

export const deleteUser = (userId) =>
  api.delete(`/api/admin/users/${userId}`);
