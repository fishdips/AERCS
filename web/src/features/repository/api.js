import api from '../../shared/api/config';

export const searchRepository = (params) =>
  api.get('/api/evidence/repository', { params });
