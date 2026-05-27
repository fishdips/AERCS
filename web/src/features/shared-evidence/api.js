import api from '../../shared/api/config';

export const searchSharedEvidence = (params) =>
  api.get('/api/evidence/referenced', { params });

export const createReference = (evidenceId, data) =>
  api.post(`/api/evidence/${evidenceId}/references`, data);

export const getReferences = (evidenceId, params) =>
  api.get(`/api/evidence/${evidenceId}/references`, { params });

export const deleteReference = (referenceId) =>
  api.delete(`/api/evidence/references/${referenceId}`);

export const listActivityReferencedEvidence = (activityId) =>
  api.get(`/api/activities/${activityId}/referenced-evidence`);
