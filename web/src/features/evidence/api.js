import api from '../../shared/api/config';

export const listEvidence = (activityId) =>
  api.get(`/api/activities/${activityId}/evidence`);

export const uploadEvidence = (activityId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/api/activities/${activityId}/evidence/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const replaceEvidence = (evidenceId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.put(`/api/evidence/${evidenceId}/replace`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteEvidence = (evidenceId) =>
  api.delete(`/api/evidence/${evidenceId}`);

export const getEvidenceMetadata = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/metadata`);

export const updateEvidenceMetadata = (evidenceId, data) =>
  api.put(`/api/evidence/${evidenceId}/metadata`, data);

export const downloadEvidenceBlob = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/download`, { responseType: 'blob' });

export const viewEvidenceBlob = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/view`, { responseType: 'blob' });

export const getEvidenceViewUrl = (evidenceId) =>
  `${api.defaults.baseURL}/api/evidence/${evidenceId}/view`;
