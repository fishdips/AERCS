import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
import {
  createLinkEvidence,
  deleteEvidence,
  downloadEvidenceBlob,
  getEvidenceViewUrl,
  listEvidence,
  replaceEvidence,
  updateLinkEvidence,
  uploadEvidence,
} from '../api';
import Modal from '../../../shared/components/Modal';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import EvidenceMetadataModal from './EvidenceMetadataModal';
import { formatEvidenceType, formatRelatedOffice } from '../constants';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActionMenu from '../../../shared/components/ActionMenu';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  FolderUp,
  Link2,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import Icon from '../../../shared/components/Icon';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png'];
const PREVIEW_TYPES = ['PDF', 'JPG', 'JPEG', 'PNG'];

function formatFileSize(size, fileType) {
  if (fileType === 'LINK') return 'Link';
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

function classifyFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { ok: false, reason: 'Unsupported file type' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: 'Exceeds 10 MB size limit' };
  }
  return { ok: true };
}

// --- Folder / drag-and-drop traversal helpers -------------------------------
// Dropped folders expose a FileSystemDirectoryEntry tree (webkitGetAsEntry)
// rather than a flat FileList, so we have to walk it ourselves.

function readEntryAsFile(entry) {
  return new Promise((resolve) => {
    entry.file(resolve, () => resolve(null));
  });
}

function readAllDirectoryEntries(reader) {
  return new Promise((resolve) => {
    const collected = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(collected);
          return;
        }
        collected.push(...batch);
        readBatch();
      }, () => resolve(collected));
    };
    readBatch();
  });
}

async function collectFilesFromEntry(entry, files) {
  if (!entry) return;
  if (entry.isFile) {
    const file = await readEntryAsFile(entry);
    if (file) files.push(file);
  } else if (entry.isDirectory) {
    const entries = await readAllDirectoryEntries(entry.createReader());
    for (const child of entries) {
      await collectFilesFromEntry(child, files);
    }
  }
}

async function getFilesFromDataTransfer(dataTransfer) {
  const items = dataTransfer?.items ? Array.from(dataTransfer.items) : [];
  const supportsEntries = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';
  if (!supportsEntries) {
    return Array.from(dataTransfer?.files || []);
  }
  const files = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      await collectFilesFromEntry(entry, files);
    } else if (item.getAsFile) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
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
  return PREVIEW_TYPES.includes(file.name.split('.').pop().toUpperCase());
}

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function hasMetadata(item) {
  return Boolean(item.evidenceType || item.relatedOffices?.length || item.tags?.length || item.notes);
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function EvidencePanel({
  activityId,
  canManageEvidence,
  batchSelectionEnabled = false,
  batchSelectedIds = [],
  hideMetadataActions = false,
  lockManagementActions = false,
  onEvidenceChange,
  onSelectAllBatchEligible,
  onToggleBatchSelection,
  onUploadStateChange,
  onUploaded,
  title = 'Attached Evidence',
}) {
  const { user } = useAuth();
  const [evidence, setEvidence] = useState([]);
  const [expandedId] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'link'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [replacement, setReplacement] = useState({ evidenceId: '', file: null, item: null });
  const [editLinkModal, setEditLinkModal] = useState({ isOpen: false, item: null, title: '', linkUrl: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [busyEvidenceId, setBusyEvidenceId] = useState('');
  const [pendingReplaceIndex, setPendingReplaceIndex] = useState(null);
  const [metadataEvidence, setMetadataEvidence] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pendingUnsupported, setPendingUnsupported] = useState(null); // { valid: File[], invalid: {name, reason}[] }
  const dragCounterRef = useRef(0);

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listEvidence(activityId);
      const items = data || [];
      setEvidence(items);
      if (onEvidenceChange) onEvidenceChange(items);
      return items;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load evidence.');
      if (onEvidenceChange) onEvidenceChange([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [activityId, onEvidenceChange]);

  useEffect(() => {
    if (activityId) loadEvidence();
  }, [activityId, loadEvidence]);

  useEffect(() => {
    if (onUploadStateChange) onUploadStateChange(isUploading);
  }, [isUploading, onUploadStateChange]);

  const canManageItem = (item) => {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'ACCRED_COORDINATOR') return true;
    return item.uploadedById != null && String(item.uploadedById) === String(user.id);
  };
  const managementLocked = lockManagementActions || isUploading;
  const selectableBatchEvidence = evidence.filter((item) => !hasMetadata(item));

  // Adds incoming files (from the file picker, folder picker, or a drag-and-drop
  // drop of files/folders) to the staging list. Files that fail validation are
  // held back and surfaced in a confirmation prompt instead of silently
  // blocking the whole batch.
  const addIncomingFiles = useCallback((incoming) => {
    if (!incoming || incoming.length === 0) return;
    const existingKeys = new Set(selectedFiles.map(fileKey));
    const localSeen = new Set();
    const valid = [];
    const invalid = [];
    incoming.forEach((file) => {
      const key = fileKey(file);
      if (existingKeys.has(key) || localSeen.has(key)) return;
      localSeen.add(key);
      const result = classifyFile(file);
      if (result.ok) valid.push(file);
      else invalid.push({ name: file.name, reason: result.reason });
    });
    if (invalid.length > 0) {
      setPendingUnsupported({ valid, invalid });
      return;
    }
    if (valid.length === 0) return;
    setError('');
    setSelectedFiles((current) => [...current, ...valid]);
  }, [selectedFiles]);

  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addIncomingFiles(files);
  };

  const handleSelectFolder = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addIncomingFiles(files);
  };

  const handleConfirmSkipUnsupported = () => {
    if (pendingUnsupported?.valid?.length) {
      setError('');
      setSelectedFiles((current) => [...current, ...pendingUnsupported.valid]);
    }
    setPendingUnsupported(null);
  };

  const handleCancelUnsupported = () => setPendingUnsupported(null);

  const handleDragEnter = (event) => {
    event.preventDefault();
    if (isUploading) return;
    dragCounterRef.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (isUploading) return;
    const files = await getFilesFromDataTransfer(event.dataTransfer);
    addIncomingFiles(files);
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  };

  const handleStartPendingReplace = (index) => setPendingReplaceIndex(index);

  const handlePendingReplace = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || pendingReplaceIndex === null) return;
    const validationError = validateFiles([file]);
    if (validationError) { setError(validationError); return; }
    setSelectedFiles((current) => current.map((f, i) => (i === pendingReplaceIndex ? file : f)));
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
    if (validationError) { setError(validationError); return; }
    if (selectedFiles.length === 0) { setError('Select at least one evidence file.'); return; }
    setIsUploading(true);
    setError('');
    try {
      const { data } = await uploadEvidence(activityId, selectedFiles);
      setSelectedFiles([]);
      await loadEvidence();
      if (onUploaded) onUploaded(data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload evidence.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) {
      setError('Google Drive / Link URL is required.');
      return;
    }
    if (!isValidUrl(linkUrl.trim())) {
      setError('Please enter a valid HTTP or HTTPS URL (e.g. https://drive.google.com/...)');
      return;
    }
    setIsUploading(true);
    setError('');
    try {
      const payload = {
        title: linkTitle.trim() || 'Google Drive Link',
        linkUrl: linkUrl.trim(),
      };
      const { data } = await createLinkEvidence(activityId, payload);
      setLinkTitle('');
      setLinkUrl('');
      await loadEvidence();
      if (onUploaded) onUploaded(data ? [data] : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add link evidence.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEditLink = async () => {
    if (!editLinkModal.linkUrl.trim()) {
      setError('Link URL is required.');
      return;
    }
    if (!isValidUrl(editLinkModal.linkUrl.trim())) {
      setError('Please enter a valid HTTP or HTTPS URL.');
      return;
    }
    setBusyEvidenceId(editLinkModal.item.id);
    setError('');
    try {
      await updateLinkEvidence(editLinkModal.item.id, {
        title: editLinkModal.title.trim() || 'Google Drive Link',
        linkUrl: editLinkModal.linkUrl.trim(),
      });
      setEditLinkModal({ isOpen: false, item: null, title: '', linkUrl: '' });
      await loadEvidence();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update link evidence.');
    } finally {
      setBusyEvidenceId('');
    }
  };

  const handleView = (item) => {
    if (item.fileType === 'LINK' || item.linkUrl) {
      window.open(item.linkUrl, '_blank');
    } else if (PREVIEW_TYPES.includes(item.fileType)) {
      window.open(getEvidenceViewUrl(item.id), '_blank');
    }
  };

  const handleDownload = async (item) => {
    if (item.fileType === 'LINK' || item.linkUrl) {
      window.open(item.linkUrl, '_blank');
      return;
    }
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
    if (validationError) { setError(validationError); return; }
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

  const handleDelete = (item) => setDeleteTarget(item);

  const confirmDelete = async () => {
    const item = deleteTarget;
    if (!item) return;
    setBusyEvidenceId(item.id);
    setError('');
    try {
      await deleteEvidence(item.id);
      await loadEvidence();
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete evidence.');
    } finally {
      setBusyEvidenceId('');
    }
  };

  return (
    <aside className="am-panel">
      <div className="am-evidence-header">
        <p className="am-section-label">{title}</p>
        {batchSelectionEnabled && (
          <button
            className="am-btn-secondary am-btn-sm"
            type="button"
            onClick={() => onSelectAllBatchEligible(selectableBatchEvidence)}
            disabled={selectableBatchEvidence.length === 0}
          >
            Select All Selectable
          </button>
        )}
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      {canManageEvidence && (
        <div className="am-evidence-upload">
          <div className="am-upload-tabs">
            <button
              className={uploadMode === 'file' ? 'am-upload-tab am-upload-tab-active' : 'am-upload-tab'}
              type="button"
              onClick={() => { setUploadMode('file'); setError(''); }}
              disabled={isUploading}
            >
              Upload Files
            </button>
            <button
              className={uploadMode === 'link' ? 'am-upload-tab am-upload-tab-active' : 'am-upload-tab'}
              type="button"
              onClick={() => { setUploadMode('link'); setError(''); }}
              disabled={isUploading}
            >
              Add Google Drive Link
            </button>
          </div>

          {uploadMode === 'file' ? (
            <>
              <div
                className={[
                  'am-dropzone',
                  isDraggingOver ? 'am-dropzone-active' : '',
                  isUploading ? 'am-dropzone-disabled' : '',
                ].filter(Boolean).join(' ')}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Icon as={UploadCloud} size={22} />
                <p className="am-dropzone-text">Drag and drop files or a folder here</p>
                <div className="am-dropzone-buttons">
                  <label className={isUploading ? 'am-btn-secondary am-link-disabled' : 'am-btn-secondary'}>
                    <Icon as={Upload} /> Browse Files
                    <input
                      className="am-hidden-input"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                      disabled={isUploading}
                      onChange={handleSelectFiles}
                    />
                  </label>
                  <label className={isUploading ? 'am-btn-secondary am-link-disabled' : 'am-btn-secondary'}>
                    <Icon as={FolderUp} /> Browse Folder
                    <input
                      className="am-hidden-input"
                      type="file"
                      multiple
                      webkitdirectory=""
                      directory=""
                      disabled={isUploading}
                      onChange={handleSelectFolder}
                    />
                  </label>
                </div>
                <p className="am-dropzone-hint">PDF, DOCX, XLSX, JPG, JPEG, PNG &middot; up to 10 MB each</p>
              </div>
              {selectedFiles.length > 0 && (
                <div className="am-selected-files">
                  {selectedFiles.map((file, index) => (
                    <div className="am-selected-file" key={`${fileKey(file)}-${index}`}>
                      <span>{file.name}</span>
                      <div className="am-selected-file-actions">
                        {canPreviewFile(file) && (
                          <button
                            className="am-link-button"
                            type="button"
                            onClick={() => handleViewSelectedFile(file)}
                            disabled={isUploading}
                          >
                            View
                          </button>
                        )}
                        <label className={isUploading ? 'am-link-button am-link-disabled' : 'am-link-button'}>
                          Replace
                          <input
                            className="am-hidden-input"
                            type="file"
                            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                            disabled={isUploading}
                            onClick={() => handleStartPendingReplace(index)}
                            onChange={handlePendingReplace}
                          />
                        </label>
                        <button
                          className="am-link-button am-link-danger"
                          type="button"
                          onClick={() => handleRemoveSelectedFile(index)}
                          disabled={isUploading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="am-evidence-actions">
                <button className="am-btn-primary" type="button" onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0}>
                  {isUploading ? 'Uploading...' : <><Icon as={Upload} /> Upload Files</>}
                </button>
                <button className="am-btn-secondary" type="button" onClick={() => setSelectedFiles([])} disabled={isUploading || selectedFiles.length === 0}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="am-form-grid" style={{ gridTemplateColumns: '1fr', gap: '0.6rem' }}>
              <label className="am-form-field">
                <span className="am-form-label">Link Title / Description</span>
                <input
                  className="am-input"
                  placeholder="e.g. 2025 Department Accreditation Drive Folder"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={isUploading}
                />
              </label>
              <label className="am-form-field">
                <span className="am-form-label">Google Drive / Web URL <span className="am-required">*</span></span>
                <input
                  className="am-input"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={isUploading}
                />
              </label>
              <div className="am-evidence-actions">
                <button className="am-btn-primary" type="button" onClick={handleAddLink} disabled={isUploading || !linkUrl.trim()}>
                  {isUploading ? 'Saving Link...' : <><Icon as={Link2} /> Add Drive Link</>}
                </button>
                <button className="am-btn-secondary" type="button" onClick={() => { setLinkTitle(''); setLinkUrl(''); }} disabled={isUploading}>
                  Clear
                </button>
              </div>
            </div>
          )}
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
              <th>File / Title</th>
              <th>Type</th>
              <th>Size</th>
              <th>Uploaded By</th>
              <th>Date</th>
              <th className="am-ev-toggle-th"></th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((item) => (
              <React.Fragment key={item.id}>
                <tr className="am-ev-row">
                  <td>
                    <div className="am-evidence-title-select">
                      {batchSelectionEnabled && (
                        <input
                          type="checkbox"
                          checked={batchSelectedIds.includes(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onToggleBatchSelection(item)}
                          title={hasMetadata(item) ? 'Already has metadata — select to edit' : 'Select for batch metadata'}
                        />
                      )}
                      <div>
                        <span className="am-evidence-name">{item.originalFileName}</span>
                        {hasMetadata(item) && (
                          <span className="am-evidence-meta am-evidence-meta-assigned">
                            <span className="am-evidence-meta-check" aria-hidden="true"><Icon as={Check} size={12} /></span>
                            {item.evidenceType ? formatEvidenceType(item.evidenceType) : 'Metadata assigned'}
                            {item.tags?.length ? ` · ${item.tags.join(', ')}` : ''}
                            {item.relatedOffices?.length
                              ? ` · ${item.relatedOffices.map(formatRelatedOffice).slice(0, 2).join(', ')}`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{item.fileType === 'LINK' ? 'LINK' : item.fileType}</td>
                  <td>{formatFileSize(item.fileSize, item.fileType)}</td>
                  <td>{item.uploadedByName || '-'}</td>
                  <td>{formatDate(item.uploadedAt)}</td>
                  <td className="am-ev-toggle-cell">
                    <ActionMenu
                      items={[
                        canManageItem(item) && !hideMetadataActions && {
                          icon: Eye,
                          label: 'View Details',
                          disabled: managementLocked,
                          onClick: () => setMetadataEvidence(item),
                        },
                        (item.fileType === 'LINK' || item.linkUrl) && {
                          icon: ExternalLink,
                          label: 'Open Link',
                          disabled: managementLocked,
                          onClick: () => handleView(item),
                        },
                        canManageItem(item) && (item.fileType === 'LINK' || item.linkUrl) && {
                          icon: Pencil,
                          label: 'Edit Link',
                          disabled: managementLocked,
                          onClick: () => setEditLinkModal({
                            isOpen: true,
                            item,
                            title: item.originalFileName || '',
                            linkUrl: item.linkUrl || '',
                          }),
                        },
                        item.fileType !== 'LINK' && !item.linkUrl && {
                          icon: Download,
                          label: busyEvidenceId === item.id ? 'Downloading...' : 'Download',
                          disabled: managementLocked || busyEvidenceId === item.id,
                          onClick: () => handleDownload(item),
                        },
                        canManageItem(item) && item.fileType !== 'LINK' && {
                          key: 'replace',
                          render: ({ className, close }) => (
                            <label className={managementLocked ? `${className} ui-action-menu-disabled` : className}>
                              <Icon as={RefreshCw} /> Replace File
                              <input
                                className="am-hidden-input"
                                type="file"
                                accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                                disabled={managementLocked}
                                onChange={(e) => {
                                  handleSelectReplacement(item, e);
                                  close();
                                }}
                              />
                            </label>
                          ),
                        },
                        canManageItem(item) && {
                          icon: Trash2,
                          label: 'Delete',
                          danger: true,
                          disabled: managementLocked || busyEvidenceId === item.id,
                          onClick: () => handleDelete(item),
                        },
                      ]}
                    />
                    <span className="am-ev-chevron"><Icon as={expandedId === item.id ? ChevronUp : ChevronDown} /></span>
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Unsupported Files Modal */}
      <Modal
        isOpen={Boolean(pendingUnsupported)}
        onClose={handleCancelUnsupported}
        title="Unsupported Files Detected"
      >
        <div className="am-replace-modal">
          <p className="am-replace-copy">
            {pendingUnsupported?.valid.length > 0
              ? `${pendingUnsupported.invalid.length} file(s) can't be added. Skip them and continue with the other ${pendingUnsupported.valid.length} file(s)?`
              : "None of the selected files can be added."}
          </p>
          <ul className="am-unsupported-list">
            {pendingUnsupported?.invalid.map((entry, index) => (
              <li key={`${entry.name}-${index}`}>
                <span className="am-unsupported-name">{entry.name}</span>
                <span className="am-unsupported-reason">{entry.reason}</span>
              </li>
            ))}
          </ul>
          <div className="am-form-actions am-replace-actions">
            <button className="am-btn-secondary" type="button" onClick={handleCancelUnsupported}>
              Cancel
            </button>
            {pendingUnsupported?.valid.length > 0 && (
              <button className="am-btn-primary" type="button" onClick={handleConfirmSkipUnsupported}>
                Skip &amp; Add {pendingUnsupported.valid.length} File(s)
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Replace File Modal */}
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
            <div><dt>Current File</dt><dd>{replacement.item?.originalFileName || '-'}</dd></div>
            <div><dt>Replacement File</dt><dd>{replacement.file?.name || '-'}</dd></div>
            <div><dt>Type</dt><dd>{replacement.file?.name?.split('.').pop()?.toUpperCase() || '-'}</dd></div>
            <div><dt>Size</dt><dd>{formatFileSize(replacement.file?.size, 'FILE')}</dd></div>
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

      {/* Edit Link Modal */}
      <Modal
        isOpen={editLinkModal.isOpen}
        onClose={() => setEditLinkModal({ isOpen: false, item: null, title: '', linkUrl: '' })}
        title="Edit Evidence Link"
      >
        <div className="am-replace-modal">
          <label className="am-form-field">
            <span className="am-form-label">Link Title / Description</span>
            <input
              className="am-input"
              value={editLinkModal.title}
              onChange={(e) => setEditLinkModal((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="am-form-field">
            <span className="am-form-label">Google Drive / Web URL <span className="am-required">*</span></span>
            <input
              className="am-input"
              type="url"
              value={editLinkModal.linkUrl}
              onChange={(e) => setEditLinkModal((prev) => ({ ...prev, linkUrl: e.target.value }))}
            />
          </label>
          <div className="am-form-actions am-replace-actions">
            <button
              className="am-btn-secondary"
              type="button"
              onClick={() => setEditLinkModal({ isOpen: false, item: null, title: '', linkUrl: '' })}
              disabled={Boolean(busyEvidenceId)}
            >
              Cancel
            </button>
            <button
              className="am-btn-primary"
              type="button"
              onClick={handleSaveEditLink}
              disabled={Boolean(busyEvidenceId) || !editLinkModal.linkUrl.trim()}
            >
              {busyEvidenceId ? 'Saving...' : 'Save Link'}
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

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove Evidence"
        message={`Remove "${deleteTarget?.originalFileName || ''}"? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        busy={Boolean(busyEvidenceId)}
      />
    </aside>
  );
}
