import api from '../../shared/api/config';

export const getDashboardSummary = () =>
  api.get('/api/dashboard/summary');
