import api from '../../shared/api/config';

export const login = (email, password) =>
  api.post('/api/auth/login', { email, password });

export const changePassword = (currentPassword, newPassword) =>
  api.patch('/api/auth/change-password', { currentPassword, newPassword });

export const forgotPassword = (email) =>
  api.post('/api/auth/forgot-password', { email });

export const resetPassword = (token, newPassword) =>
  api.post('/api/auth/reset-password', { token, newPassword });
