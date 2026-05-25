import api from '../../shared/api/config';

export const createActivity = (data) =>
  api.post('/api/activities', data);

export const listActivities = () =>
  api.get('/api/activities');

export const getActivity = (activityId) =>
  api.get(`/api/activities/${activityId}`);

export const updateActivity = (activityId, data) =>
  api.put(`/api/activities/${activityId}`, data);

export const deleteActivity = (activityId) =>
  api.delete(`/api/activities/${activityId}`);
