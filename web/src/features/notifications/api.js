import api from '../../shared/api/config';

// A staff member's own notifications (department staff, chairperson, institutional staff).
// Never cached: the list is how the page learns about new activity.
export const getStaffNotifications = () =>
  api.get('/api/notifications', { cache: false });

export const markStaffNotificationRead = (id) =>
  api.post(`/api/notifications/${id}/read`);

export const markAllStaffNotificationsRead = () =>
  api.post('/api/notifications/read-all');
