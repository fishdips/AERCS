import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteEvidence,
  downloadEvidenceBlob,
  getEvidenceViewUrl,
  listEvidence,
  replaceEvidence,
  uploadEvidence,
} from '../api';
import Modal from '../../../shared/components/Modal';
import EvidenceMetadataModal from './EvidenceMetadataModal';
import { formatEvidenceType, formatRelatedOffice } from '../constants';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png'];
const PREVIEW_TYPES = ['PDF', 'JPG', 'JPEG', 'PNG'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function validateFiles(files) {
  if (files.length === 0) return '';

  for (const file of files) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return 'Allowed file types: PDF, DOCX, XLSX, JPG, JPEG, PNG';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Each evidence file must not exceed 10 MB';
    }
  }
  return '';
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function canPreviewFile(file) {
  const extension = file.name.split('.').pop().toUpperCase();
  return PREVIEW_TYPES.includes(extension);
}

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function hasMetadata(item) {
  return Boolean(item.evidenceType || item.relatedOffices?.length || item.tags?.length || item.notes);
}

export default function EvidencePanel({ activityId, canManageEvidence }) {
  const [evidence, setEvidence] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replacement, setReplacement] = useState({ evidenceId: '', file: null, item: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [busyEvidenceId, setBusyEvidenceId] = useState('');
  const [pendingReplaceIndex, setPendingReplaceIndex] = useState(null);
  const [metadataEvidence, setMetadataEvidence] = useState(null);

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listEvidence(activityId);
      setEvidence(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load evidence.');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (activityId) loadEvidence();
  }, [activityId, loadEvidence]);

  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);
    const validationError = validateFiles(files);
    event.target.value = '';
    setError(validationError);
    if (validationError) return;

    setSelectedFiles((current) => {
      const existingKeys = new Set(current.map(fileKey));
      const newFiles = files.filter((file) => !existingKeys.has(fileKey(file)));
      return [...current, ...newFiles];
    });
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleStartPendingReplace = (index) => {
    setPendingReplaceIndex(index);
  };

  const handlePendingReplace = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || pendingReplaceIndex === null) return;

    const validationError = validateFiles([file]);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFiles((current) => current.map((existingFile, index) => (
      index === pendingReplaceIndex ? file : existingFile
    )));
    setPendingReplaceIndex(null);
    setError('');
  };

  const handleViewSelectedFile = (file) => {
    if (!canPreviewFile(file)) return;

    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleUpload = async () => {
    const validationError = validateFiles(selectedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Select at least one evidence file.');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      await uploadEvidence(activityId, selectedFiles);
      setSelectedFiles([]);
      await loadEvidence();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload evidence.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleView = async (item) => {
    if (!PREVIEW_TYPES.includes(item.fileType)) return;

    window.open(getEvidenceViewUrl(item.id), '_blank');
  };

  const handleDownload = async (item) => {
    setBusyEvidenceId(item.id);
    setError('');
    try {
      const { data } = await downloadEvidenceBlob(item.id);
      saveBlob(data, item.originalFileName);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download evidence.');
    } finally {
      setBusyEvidenceId('');
    }
  };

  const handleSelectReplacement = (item, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateFiles([file]);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setReplacement({ evidenceId: item.id, file, item });
  };

  const handleReplace = async () => {
    if (!replacement.evidenceId || !replacement.file) return;

    setBusyEvidenceId(replacement.evidenceId);
    setError('');
    try {
      await replaceEvidence(replacement.evidenceId, replacement.file);
      setReplacement({ evidenceId: '', file: null, item: null });
      await loadEvidence();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to replace evidence.');
    } finally {
      setBusyEvidenceId('');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to remove this evidence?')) return;

    setBusyEvidenceId(item.id);
    setError('');
    try {
      await deleteEvidence(item.id);
      await loadEvidence();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete evidence.');
    } finally {
      setBusyEvidenceId('');
    }
  };

  return (
    <aside className="am-panel">
      <div className="am-evidence-header">
        <p className="am-section-label">Attached Evidence</p>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      {canManageEvidence && (
        <div className="am-evidence-upload">
          <input
            className="am-input"
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
            onChange={handleSelectFiles}
          />
          {selectedFiles.length > 0 && (
            <div className="am-selected-files">
              {selectedFiles.map((file, index) => (
                <div className="am-selected-file" key={`${fileKey(file)}-${index}`}>
                  <span>{file.name}</span>
                  <div className="am-selected-file-actions">
                    {canPreviewFile(file) && (
                      <button className="am-link-button" type="button" onClick={() => handleViewSelectedFile(file)}>
                        View
                      </button>
                    )}
                    <label className="am-link-button">
                      Replace
                      <input
                        className="am-hidden-input"
                        type="file"
                        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                        onClick={() => handleStartPendingReplace(index)}
                        onChange={handlePendingReplace}
                      />
                    </label>
                    <button className="am-link-button am-link-danger" type="button" onClick={() => handleRemoveSelectedFile(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="am-evidence-actions">
            <button className="am-btn-primary" type="button" onClick={handleUpload} disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Evidence'}
            </button>
            <button className="am-btn-secondary" type="button" onClick={() => setSelectedFiles([])} disabled={isUploading}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="am-evidence-placeholder"><span>Loading evidence...</span></div>}

      {!loading && evidence.length === 0 && (
        <div className="am-evidence-placeholder">
          <span>No evidence uploaded yet.</span>
        </div>
      )}

      {!loading && evidence.length > 0 && (
        <table className="am-evidence-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>File Type</th>
              <th>File Size</th>
              <th>Uploaded Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="am-evidence-name">{item.originalFileName}</span>
                  {hasMetadata(item) && (
                    <span className="am-evidence-meta">
                      {item.evidenceType ? formatEvidenceType(item.evidenceType) : 'Metadata added'}
                      {item.tags?.length ? ` · ${item.tags.join(', ')}` : ''}
                      {item.relatedOffices?.length ? ` · ${item.relatedOffices.map(formatRelatedOffice).slice(0, 2).join(', ')}` : ''}
                    </span>
                  )}
                </td>
                <td>{item.fileType}</td>
                <td>{formatFileSize(item.fileSize)}</td>
                <td>{formatDate(item.uploadedAt)}</td>
                <td>
                  <div className="am-evidence-row-actions">
                    {PREVIEW_TYPES.includes(item.fileType) && (
                      <button className="am-link-button" type="button" onClick={() => handleView(item)} disabled={busyEvidenceId === item.id}>
                        View
                      </button>
                    )}
                    <button className="am-link-button" type="button" onClick={() => handleDownload(item)} disabled={busyEvidenceId === item.id}>
                      Download
                    </button>
                    {canManageEvidence && (
                      <>
                        <button className="am-link-button" type="button" onClick={() => setMetadataEvidence(item)}>
                          {hasMetadata(item) ? 'Edit Metadata' : 'Add Metadata'}
                        </button>
                        <label className="am-link-button">
                          Replace
                          <input
                            className="am-hidden-input"
                            type="file"
                            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                            onChange={(event) => handleSelectReplacement(item, event)}
                          />
                        </label>
                        <button className="am-link-button am-link-danger" type="button" onClick={() => handleDelete(item)} disabled={busyEvidenceId === item.id}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Modal
        isOpen={Boolean(replacement.evidenceId && replacement.file)}
        onClose={() => setReplacement({ evidenceId: '', file: null, item: null })}
        title="Replace Evidence"
      >
        <div className="am-replace-modal">
          <p className="am-replace-copy">
            Save this replacement to update the selected evidence record. The current file will be replaced.
          </p>
          <dl className="am-replace-details">
            <div>
              <dt>Current File</dt>
              <dd>{replacement.item?.originalFileName || '-'}</dd>
            </div>
            <div>
              <dt>Replacement File</dt>
              <dd>{replacement.file?.name || '-'}</dd>
            </div>
            <div>
              <dt>Replacement Type</dt>
              <dd>{replacement.file?.name?.split('.').pop()?.toUpperCase() || '-'}</dd>
            </div>
            <div>
              <dt>Replacement Size</dt>
              <dd>{formatFileSize(replacement.file?.size)}</dd>
            </div>
          </dl>
          <div className="am-form-actions am-replace-actions">
            <button
              className="am-btn-secondary"
              type="button"
              onClick={() => setReplacement({ evidenceId: '', file: null, item: null })}
              disabled={Boolean(busyEvidenceId)}
            >
              Cancel
            </button>
            <button
              className="am-btn-primary"
              type="button"
              onClick={handleReplace}
              disabled={Boolean(busyEvidenceId)}
            >
              {busyEvidenceId ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
      <EvidenceMetadataModal
        evidence={metadataEvidence}
        isOpen={Boolean(metadataEvidence)}
        onClose={() => setMetadataEvidence(null)}
        onSaved={loadEvidence}
      />
    </aside>
  );
}
