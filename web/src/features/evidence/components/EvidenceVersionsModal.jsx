import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import Alert from '../../../shared/components/Alert';
import EvidencePreview from '../../../shared/components/EvidencePreview';
import Icon from '../../../shared/components/Icon';
import {
  deleteEvidenceVersion,
  downloadEvidenceVersionBlob,
  listEvidenceVersions,
  restoreEvidenceVersion,
} from '../api';
import { Check, Download, Eye, History, Maximize2, Minimize2, RotateCcw, Trash2 } from 'lucide-react';

const PREVIEWABLE_TYPES = ['PDF', 'DOCX', 'XLSX', 'JPG', 'JPEG', 'PNG'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

export default function EvidenceVersionsModal({
  evidence,
  isOpen,
  onClose,
  canManage = false,
  onRestored,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [busyVersionId, setBusyVersionId] = useState('');
  const [previewVersion, setPreviewVersion] = useState(null);
  const [expandedPreview, setExpandedPreview] = useState(false);
  // Versions already previewed stay mounted (hidden) so switching back needs no fetch or re-render.
  const [visitedIds, setVisitedIds] = useState([]);
  // Set when a restore/delete happened, so the parent list is refreshed once on close.
  const changedRef = useRef(false);
  // The version whose "Delete" is waiting for a second click. Deleting is permanent, so it asks first.
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  useEffect(() => {
    const id = previewVersion?.id;
    if (!id) return;
    setVisitedIds((current) => (current.includes(id) ? current : [...current, id]));
  }, [previewVersion?.id]);

  const handleClose = () => {
    const changed = changedRef.current;
    changedRef.current = false;
    onClose();
    if (changed && onRestored) onRestored();
  };

  const loadVersions = useCallback(async () => {
    if (!evidence?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await listEvidenceVersions(evidence.id);
      const list = data || [];
      setVersions(list);
      setPreviewVersion((current) => {
        if (current && list.some((v) => v.id === current.id)) {
          return list.find((v) => v.id === current.id);
        }
        return list[0] || null;
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load version history.');
    } finally {
      setLoading(false);
    }
  }, [evidence?.id]);

  useEffect(() => {
    if (isOpen && evidence?.id) {
      setSuccessMessage('');
      loadVersions();
    } else {
      setVersions([]);
      setPreviewVersion(null);
      setVisitedIds([]);
      setConfirmDeleteId('');
      setExpandedPreview(false);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen, evidence?.id, loadVersions]);

  const handleDownloadVersion = async (ver) => {
    if (!evidence?.id || !ver?.id) return;
    setBusyVersionId(ver.id);
    setError('');
    try {
      const { data } = await downloadEvidenceVersionBlob(evidence.id, ver.id);
      saveBlob(data, ver.originalFileName || `v${ver.versionNumber}-${evidence.originalFileName}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download this version.');
    } finally {
      setBusyVersionId('');
    }
  };

  const handleRestoreVersion = async (ver) => {
    if (!evidence?.id || !ver?.id) return;
    setBusyVersionId(ver.id);
    setError('');
    setSuccessMessage('');
    try {
      await restoreEvidenceVersion(evidence.id, ver.id);
      setSuccessMessage(`Switched back to v${ver.versionNumber} as the current version.`);
      setPreviewVersion(ver);
      setVersions((list) => list.map((v) => ({ ...v, isCurrent: v.id === ver.id })));
      changedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to restore this version.');
    } finally {
      setBusyVersionId('');
    }
  };

  const handleDeleteVersion = async (ver) => {
    if (!evidence?.id || !ver?.id) return;
    setBusyVersionId(ver.id);
    setError('');
    setSuccessMessage('');
    try {
      await deleteEvidenceVersion(evidence.id, ver.id);
      setSuccessMessage(`Removed v${ver.versionNumber}.`);
      const remaining = versions.filter((v) => v.id !== ver.id);
      setVersions(remaining);
      setVisitedIds((ids) => ids.filter((id) => id !== ver.id));
      setPreviewVersion((current) => (
        current && current.id !== ver.id
          ? current
          : remaining.find((v) => v.isCurrent) || remaining[0] || null
      ));
      changedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove this version.');
    } finally {
      setBusyVersionId('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Version History — ${evidence?.originalFileName || 'Evidence'}`}
      size="wide"
    >
      <div className="am-versions-modal">
        <Alert type="error" message={error} onDismiss={() => setError('')} />
        {successMessage && <p className="am-alert am-alert-success">{successMessage}</p>}

        {loading && <p className="am-empty am-empty-plain">Loading version history...</p>}

        {!loading && versions.length === 0 && (
          <p className="am-empty am-empty-plain">No file versions found.</p>
        )}

        {!loading && versions.length > 0 && (
          <div className={expandedPreview ? 'am-versions-layout am-versions-layout-expanded' : 'am-versions-layout'}>
            {!expandedPreview && (
              <div className="am-versions-list-col">
                <div className="am-versions-header">
                  <p className="am-section-label">
                    <Icon as={History} size={13} /> All Versions ({versions.length})
                  </p>
                </div>
                <p className="am-helper-text" style={{ margin: '-0.25rem 0 0.15rem 0' }}>
                  Identical file content is blocked; each revision is preserved.
                </p>

                <div className="am-versions-list">
                  {versions.map((ver) => {
                    const isSelected = previewVersion?.id === ver.id;
                    const canPreview = PREVIEWABLE_TYPES.includes(ver.fileType);
                    const isBusy = busyVersionId === ver.id;
                    return (
                      <div
                        key={ver.id}
                        className={[
                          'am-version-card',
                          ver.isCurrent ? 'am-version-card-current' : '',
                          isSelected ? 'am-version-card-selected' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="am-version-card-top">
                          <div className="am-version-badges">
                            <span className="am-version-pill">v{ver.versionNumber}</span>
                            {ver.isCurrent && (
                              <span className="am-version-current-badge">
                                <Icon as={Check} size={11} /> Current
                              </span>
                            )}
                            <span className="am-version-filename">{ver.originalFileName}</span>
                          </div>
                          <span className="am-version-meta-inline">
                            {ver.fileType} &middot; {formatFileSize(ver.fileSize)}
                          </span>
                        </div>

                        {ver.versionNote && (
                          <p className="am-version-note">{ver.versionNote}</p>
                        )}

                        <div className="am-version-card-footer">
                          <span className="am-version-sub">
                            Uploaded by <strong>{ver.uploadedByName || 'Staff'}</strong> &middot; {formatDateTime(ver.uploadedAt)}
                          </span>

                          <div className="am-version-actions">
                            {canPreview && (
                              <button
                                type="button"
                                className={isSelected ? 'am-btn-primary am-btn-sm' : 'am-link-button am-btn-sm'}
                                onClick={() => setPreviewVersion(ver)}
                                disabled={Boolean(busyVersionId)}
                              >
                                <Icon as={Eye} size={12} /> {isSelected ? 'Previewing' : 'Preview'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="am-link-button am-btn-sm"
                              onClick={() => handleDownloadVersion(ver)}
                              disabled={Boolean(busyVersionId)}
                            >
                              <Icon as={Download} size={12} /> {isBusy ? 'Working...' : 'Download'}
                            </button>
                            {canManage && !ver.isCurrent && confirmDeleteId === ver.id && (
                              <>
                                <span style={{ color: '#b91c1c', fontSize: '0.72rem', fontWeight: 600 }}>
                                  Delete v{ver.versionNumber} permanently?
                                </span>
                                <button
                                  type="button"
                                  className="am-btn-secondary am-btn-sm"
                                  onClick={() => setConfirmDeleteId('')}
                                  disabled={Boolean(busyVersionId)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="am-btn-danger am-btn-sm"
                                  onClick={() => {
                                    setConfirmDeleteId('');
                                    handleDeleteVersion(ver);
                                  }}
                                  disabled={Boolean(busyVersionId)}
                                >
                                  <Icon as={Trash2} size={12} /> Yes, delete
                                </button>
                              </>
                            )}
                            {canManage && !ver.isCurrent && confirmDeleteId !== ver.id && (
                              <>
                                <button
                                  type="button"
                                  className="am-btn-secondary am-btn-sm"
                                  onClick={() => handleRestoreVersion(ver)}
                                  disabled={Boolean(busyVersionId)}
                                  title={`Set v${ver.versionNumber} as the current active version`}
                                >
                                  <Icon as={RotateCcw} size={12} /> Restore
                                </button>
                                {versions.length > 1 && (
                                  <button
                                    type="button"
                                    className="am-link-button am-link-danger am-btn-sm"
                                    onClick={() => setConfirmDeleteId(ver.id)}
                                    disabled={Boolean(busyVersionId)}
                                    title={`Delete v${ver.versionNumber}`}
                                  >
                                    <Icon as={Trash2} size={12} /> Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="am-versions-preview-col">
              <div className="am-versions-header">
                <div className="am-versions-preview-title-group">
                  <p className="am-section-label">
                    {previewVersion
                      ? `Preview — v${previewVersion.versionNumber} (${previewVersion.originalFileName})`
                      : 'Preview'}
                  </p>
                  {expandedPreview && versions.length > 1 && (
                    <div className="am-version-QuickSwitch">
                      {versions.map((ver) => (
                        <button
                          key={ver.id}
                          type="button"
                          className={
                            previewVersion?.id === ver.id
                              ? 'am-version-badge am-version-badge-multi'
                              : 'am-version-badge'
                          }
                          onClick={() => setPreviewVersion(ver)}
                        >
                          v{ver.versionNumber}{ver.isCurrent ? ' (Current)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="am-version-actions">
                  {previewVersion && (
                    <button
                      type="button"
                      className="am-link-button am-btn-sm"
                      onClick={() => handleDownloadVersion(previewVersion)}
                      disabled={Boolean(busyVersionId)}
                    >
                      <Icon as={Download} size={12} /> Download v{previewVersion.versionNumber}
                    </button>
                  )}
                  <button
                    type="button"
                    className="am-btn-secondary am-btn-sm"
                    onClick={() => setExpandedPreview((prev) => !prev)}
                  >
                    <Icon as={expandedPreview ? Minimize2 : Maximize2} size={12} />{' '}
                    {expandedPreview ? 'Split View' : 'Expand Preview'}
                  </button>
                </div>
              </div>

              <div className="am-versions-preview-box">
                {previewVersion ? (
                  versions
                    .filter((v) => v.id === previewVersion.id || visitedIds.includes(v.id))
                    .map((v) => (
                      <div
                        key={`${evidence?.id}-${v.id}`}
                        style={{
                          display: v.id === previewVersion.id ? 'flex' : 'none',
                          flexDirection: 'column',
                          flex: 1,
                          minHeight: 0,
                        }}
                      >
                        <EvidencePreview
                          evidenceId={evidence?.id}
                          versionId={v.id}
                          fileType={v.fileType}
                          fileName={v.originalFileName}
                        />
                      </div>
                    ))
                ) : (
                  <div className="am-evidence-placeholder">
                    <span>Select a version to preview.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="am-form-actions am-replace-actions">
          <button className="am-btn-secondary" type="button" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

