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

export const deleteUser = (userId) =>
  api.delete(`/api/admin/users/${userId}`);
