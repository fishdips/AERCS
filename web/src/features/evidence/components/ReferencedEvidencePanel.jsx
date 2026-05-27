import { useCallback, useEffect, useState } from 'react';
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
              <th>Source Activity</th>
              <th>Source Office</th>
              <th>Referenced</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.referenceId}>
                <td>
                  <span className="am-evidence-name">{item.originalFileName}</span>
                  <span className="am-evidence-meta">
                    Referenced evidence - {formatFileSize(item.fileSize)}
                    {item.evidenceType ? ` - ${formatEvidenceType(item.evidenceType)}` : ''}
                    {item.accreditationArea ? ` - ${formatAccreditationArea(item.accreditationArea)}` : ''}
                  </span>
                </td>
                <td>
                  <Link className="am-link-button" to={`/activities/${item.sourceActivityId}`}>
                    {item.sourceActivityName || 'Source Activity'}
                  </Link>
                </td>
                <td>{item.sourceOffice || '-'}</td>
                <td>{formatDate(item.referencedAt)}</td>
                <td>
                  <div className="am-evidence-row-actions">
                    {PREVIEW_TYPES.includes(item.fileType) && (
                      <a
                        className="am-link-button"
                        href={getEvidenceViewUrl(item.evidenceId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
                    <button
                      className="am-link-button"
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={busyId === item.referenceId}
                    >
                      Download
                    </button>
                    {canManageReferences && (
                      <button
                        className="am-link-button am-link-danger"
                        type="button"
                        onClick={() => handleRemove(item)}
                        disabled={busyId === item.referenceId}
                      >
                        Remove Reference
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
