import api from './config';

// Used by AuthContext — session-level calls available globally
export const getMe = () =>
  api.get('/api/auth/me');

export const logout = () =>
  api.post('/api/auth/logout');
