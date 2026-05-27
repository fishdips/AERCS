import api from '../../shared/api/config';

export const generateAccreditorAccess = (data) =>
  api.post('/api/accreditor-access/generate', data);

export const getPublicAccreditorAccess = (token) =>
  api.get(`/api/public/accreditor-access/${token}`);

export const getPublicEvidenceViewUrl = (token, evidenceId) =>
  `${api.defaults.baseURL}/api/public/accreditor-access/${token}/evidence/${evidenceId}/view`;

export const downloadPublicEvidenceBlob = (token, evidenceId) =>
  api.get(`/api/public/accreditor-access/${token}/evidence/${evidenceId}/download`, { responseType: 'blob' });
