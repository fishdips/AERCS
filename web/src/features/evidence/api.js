import api from '../../shared/api/config';

export const getEvidence = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}`);

export const listEvidence = (activityId) =>
  api.get(`/api/activities/${activityId}/evidence`);

export const uploadEvidence = (activityId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/api/activities/${activityId}/evidence/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const createLinkEvidence = (activityId, data) =>
  api.post(`/api/activities/${activityId}/evidence/link`, data);

export const updateLinkEvidence = (evidenceId, data) =>
  api.put(`/api/evidence/${evidenceId}/link`, data);

export const replaceEvidence = (evidenceId, file, versionNote) => {
  const formData = new FormData();
  formData.append('file', file);
  if (versionNote && versionNote.trim()) {
    formData.append('versionNote', versionNote.trim());
  }
  return api.put(`/api/evidence/${evidenceId}/replace`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const listEvidenceVersions = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/versions`);

export const downloadEvidenceVersionBlob = (evidenceId, versionId) =>
  api.get(`/api/evidence/${evidenceId}/versions/${versionId}/download`, { responseType: 'blob' });

export const viewEvidenceVersionBlob = (evidenceId, versionId) =>
  api.get(`/api/evidence/${evidenceId}/versions/${versionId}/view`, { responseType: 'blob' });

export const getEvidenceVersionViewUrl = (evidenceId, versionId) =>
  `${api.defaults.baseURL}/api/evidence/${evidenceId}/versions/${versionId}/view`;

export const restoreEvidenceVersion = (evidenceId, versionId) =>
  api.post(`/api/evidence/${evidenceId}/versions/${versionId}/restore`);

export const deleteEvidenceVersion = (evidenceId, versionId) =>
  api.delete(`/api/evidence/${evidenceId}/versions/${versionId}`);

export const deleteEvidence = (evidenceId) =>
  api.delete(`/api/evidence/${evidenceId}`);

export const getEvidenceMetadata = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/metadata`);

export const updateEvidenceMetadata = (evidenceId, data) =>
  api.put(`/api/evidence/${evidenceId}/metadata`, data);

export const updateEvidenceMetadataBatch = (data) =>
  api.put('/api/evidence/metadata/batch', data);

export const downloadEvidenceBlob = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/download`, { responseType: 'blob' });

export const viewEvidenceBlob = (evidenceId) =>
  api.get(`/api/evidence/${evidenceId}/view`, { responseType: 'blob' });

export const getEvidenceViewUrl = (evidenceId) =>
  `${api.defaults.baseURL}/api/evidence/${evidenceId}/view`;
