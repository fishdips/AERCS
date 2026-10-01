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
  api.get(`/api/accreditor/links/${id}`);

export const getAccreditorEvidenceViewUrl = (linkId, evidenceId) =>
  `${api.defaults.baseURL}/api/accreditor/links/${linkId}/evidence/${evidenceId}/view`;

export const downloadAccreditorEvidenceBlob = (linkId, evidenceId) =>
  api.get(`/api/accreditor/links/${linkId}/evidence/${evidenceId}/download`, { responseType: 'blob' });
