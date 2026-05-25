import api from '../../shared/api/config';

export const login = (email, password) =>
  api.post('/api/auth/login', { email, password });

export const changePassword = (currentPassword, newPassword) =>
  api.patch('/api/auth/change-password', { currentPassword, newPassword });
