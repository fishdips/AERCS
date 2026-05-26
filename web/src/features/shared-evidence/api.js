import api from '../../shared/api/config';

export const searchSharedEvidence = (params) =>
  api.get('/api/evidence/shared', { params });

export const createReference = (evidenceId, data) =>
  api.post(`/api/evidence/${evidenceId}/references`, data);

export const getReferences = (evidenceId, params) =>
  api.get(`/api/evidence/${evidenceId}/references`, { params });

export const deleteReference = (referenceId) =>
  api.delete(`/api/evidence/references/${referenceId}`);
