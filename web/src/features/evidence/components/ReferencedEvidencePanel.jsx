import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { Link } from 'react-router-dom';
import { downloadEvidenceBlob, getEvidenceViewUrl } from '../api';
import { deleteReference, listActivityReferencedEvidence } from '../../shared-evidence/api';
import { formatAccreditationArea } from '../../activities/constants';
import { formatEvidenceType } from '../constants';

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

export default function ReferencedEvidencePanel({ activityId, canManageReferences }) {
  const [expandedId, setExpandedId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadReferences = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listActivityReferencedEvidence(activityId);
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load referenced evidence.');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (activityId) loadReferences();
  }, [activityId, loadReferences]);

  const toggleRow = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const handleDownload = async (item) => {
    setBusyId(item.referenceId);
    setError('');
    try {
      const { data } = await downloadEvidenceBlob(item.evidenceId);
      saveBlob(data, item.originalFileName);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download evidence.');
    } finally {
      setBusyId('');
    }
  };

  const handleRemove = async (item) => {
    if (!window.confirm('Remove this reference from the activity? The original evidence file will remain.')) return;
    setBusyId(item.referenceId);
    setError('');
    try {
      await deleteReference(item.referenceId);
      if (expandedId === item.referenceId) setExpandedId(null);
      await loadReferences();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove reference.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <aside className="am-panel">
      <div className="am-evidence-header">
        <p className="am-section-label">Referenced Evidence</p>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}
      {loading && <div className="am-evidence-placeholder"><span>Loading referenced evidence...</span></div>}

      {!loading && items.length === 0 && (
        <div className="am-evidence-placeholder">
          <span>No evidence referenced into this activity.</span>
        </div>
      )}

      {!loading && items.length > 0 && (
        <table className="am-evidence-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Source Office</th>
              <th>Size</th>
              <th>Referenced</th>
              <th className="am-ev-toggle-th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={item.referenceId}>
                <tr
                  className={`am-ev-row${expandedId === item.referenceId ? ' am-ev-row-open' : ''}`}
                  onClick={() => toggleRow(item.referenceId)}
                >
                  <td>
                    <span className="am-evidence-name">{item.originalFileName}</span>
                    <span className="am-evidence-meta">
                      {item.evidenceType ? formatEvidenceType(item.evidenceType) : 'Referenced'}
                      {item.accreditationArea ? ` · ${formatAccreditationArea(item.accreditationArea)}` : ''}
                    </span>
                  </td>
                  <td>{item.sourceOffice || '-'}</td>
                  <td>{formatFileSize(item.fileSize)}</td>
                  <td>{formatDate(item.referencedAt)}</td>
                  <td className="am-ev-toggle-cell">
                    <span className="am-ev-chevron">{expandedId === item.referenceId ? '▴' : '▾'}</span>
                  </td>
                </tr>

                {expandedId === item.referenceId && (
                  <tr className="am-ev-drawer-row">
                    <td colSpan={5}>
                      <div className="am-ev-drawer">
                        <p className="am-ev-drawer-uploader">
                          Source: <Link className="am-link-button" to={`/activities/${item.sourceActivityId}`}>{item.sourceActivityName || 'Source Activity'}</Link>
                          {item.referencedByName ? ` · Referenced by ${item.referencedByName}` : ''}
                        </p>
                        <div className="am-ev-drawer-actions">
                          {(item.fileType === 'LINK' || item.linkUrl) && (
                            <a
                              className="am-btn-primary am-btn-sm"
                              href={item.linkUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              🔗 Open Link
                            </a>
                          )}
                          {PREVIEW_TYPES.includes(item.fileType) && (
                            <a
                              className="am-btn-secondary am-btn-sm"
                              href={getEvidenceViewUrl(item.evidenceId)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          )}
                          {item.fileType !== 'LINK' && !item.linkUrl && (
                            <button
                              className="am-btn-secondary am-btn-sm"
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                              disabled={busyId === item.referenceId}
                            >
                              {busyId === item.referenceId ? 'Downloading...' : 'Download'}
                            </button>
                          )}
                          {canManageReferences && (
                            <button
                              className="am-btn-danger am-btn-sm"
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                              disabled={busyId === item.referenceId}
                            >
                              Remove Reference
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
