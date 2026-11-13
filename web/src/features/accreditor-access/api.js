import api from '../../shared/api/config';

// ---- Staff: create links and assign them to accreditor accounts ----

export const generateAccreditorAccess = (data) =>
  api.post('/api/accreditor-access/generate', data);

export const getAccreditorAccessLinks = () =>
  api.get('/api/accreditor-access');

export const getAccreditors = () =>
  api.get('/api/accreditor-access/accreditors');

export const updateAccreditorAccess = (id, data) =>
  api.patch(`/api/accreditor-access/${id}`, data);

export const extendAccreditorAccess = (id, expiresAt) =>
  updateAccreditorAccess(id, { expiresAt });

export const assignAccreditors = (accessIds, accreditorIds) =>
  api.post('/api/accreditor-access/assign', { accessIds, accreditorIds });

export const deleteAccreditorAccess = (id) =>
  api.delete(`/api/accreditor-access/${id}`);

// ---- Accreditor: links assigned to the signed-in accreditor account ----

export const getMyAccreditorLinks = () =>
  api.get('/api/accreditor/links');

export const getMyAccreditorLink = (id) =>
  api.get(`/api/accreditor/links/${id}`, { params: { _t: Date.now() } });

// Accreditors are view-only: the file is fetched as a blob and drawn by the in-app viewer.
// There is deliberately no download call here (the server has no download endpoint for them).
export const viewAccreditorEvidenceBlob = (linkId, evidenceId, version) =>
  api.get(`/api/accreditor/links/${linkId}/evidence/${evidenceId}/view`, {
    params: { v: version || 1, _t: Date.now() },
    responseType: 'blob',
  });

// ---- Accreditor: notifications (a link was shared with me / is about to expire) ----

// Never cached: the list is how the page learns about new notices as time passes.
export const getMyNotifications = () =>
  api.get('/api/accreditor/notifications', { cache: false });

export const markNotificationRead = (id) =>
  api.post(`/api/accreditor/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.post('/api/accreditor/notifications/read-all');
