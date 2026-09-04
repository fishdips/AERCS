import api from '../../shared/api/config';

export const generateAccreditorAccess = (data) =>
  api.post('/api/accreditor-access/generate', data);

export const extendAccreditorAccess = (id, expiresAt) =>
  api.patch(`/api/accreditor-access/${id}`, { expiresAt });

export const deleteAccreditorAccess = (id) =>
  api.delete(`/api/accreditor-access/${id}`);

export const getPublicAccreditorAccess = (token) =>
  api.get(`/api/public/accreditor-access/${token}`);

export const getPublicEvidenceViewUrl = (token, evidenceId) =>
  `${api.defaults.baseURL}/api/public/accreditor-access/${token}/evidence/${evidenceId}/view`;

export const downloadPublicEvidenceBlob = (token, evidenceId) =>
  api.get(`/api/public/accreditor-access/${token}/evidence/${evidenceId}/download`, { responseType: 'blob' });
