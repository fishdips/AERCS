import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import {
  downloadAccreditorEvidenceBlob,
  getAccreditorEvidenceViewUrl,
  getMyAccreditorLink,
} from '../api';
import { formatAccreditationArea, formatDepartment, formatOffice } from '../../activities/constants';
import { formatEvidenceType } from '../../evidence/constants';
import '../AccreditorAccess.css';
import { ExternalLink } from 'lucide-react';
import Icon from '../../../shared/components/Icon';

const PREVIEW_TYPES = ['PDF', 'JPG', 'JPEG', 'PNG'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

function formatOwnerOffice(value) {
  if (!value) return '-';
  const office = formatOffice(value);
  if (office !== value) return office;
  return formatDepartment(value);
}

export default function AccreditorLinkDetailPage() {
  const { id } = useParams();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getMyAccreditorLink(id)
      .then(({ data }) => setAccess(data))
      .catch(() => setError('This evidence link is unavailable. It may have expired or was not shared with your account.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async (item) => {
    setBusyId(item.id);
    setError('');
    try {
      const { data } = await downloadAccreditorEvidenceBlob(id, item.id);
      saveBlob(data, item.originalFileName);
    } catch {
      setError('Unable to download this evidence file.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <ActivityShell>
      <div className="am-breadcrumb">
        <Link to="/accreditor">Evidence Links</Link> / {access?.name || 'Link'}
      </div>

      <div className="am-page-header">
        <div className="am-page-header-left">
          <h1 className="am-page-title">{access?.name || 'Evidence Link'}</h1>
          {access && (
            <p className="am-description">
              {access.sharedBy ? `Shared by ${access.sharedBy} · ` : ''}
              Expires {new Date(access.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {loading && <p className="am-empty am-empty-plain">Loading evidence...</p>}
      {error && <p className="am-alert am-alert-error">{error}</p>}

      {!loading && access && (
        <>
          {access.notes && <p className="aa-notes">{access.notes}</p>}

          <div className="aa-table-wrap">
            <table className="aa-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Source Activity</th>
                  <th>Owner Office</th>
                  <th>Accreditation Area</th>
                  <th>Academic Year</th>
                  <th>Evidence Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {access.evidence.length === 0 && (
                  <tr><td colSpan={7} className="aa-empty">No evidence is available for this link.</td></tr>
                )}
                {access.evidence.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.originalFileName}</strong>
                      <span>{item.fileType} - {formatFileSize(item.fileSize)}</span>
                    </td>
                    <td>{item.sourceActivity || '-'}</td>
                    <td>{formatOwnerOffice(item.ownerOffice)}</td>
                    <td>{formatAccreditationArea(item.accreditationArea)}</td>
                    <td>{item.academicYear || '-'}</td>
                    <td>{formatEvidenceType(item.evidenceType)}</td>
                    <td>
                      <div className="aa-row-actions">
                        {(item.fileType === 'LINK' || item.linkUrl) && (
                          <a href={item.linkUrl} target="_blank" rel="noreferrer"><Icon as={ExternalLink} /> Open Link</a>
                        )}
                        {PREVIEW_TYPES.includes(item.fileType) && (
                          <a href={getAccreditorEvidenceViewUrl(id, item.id)} target="_blank" rel="noreferrer">View</a>
                        )}
                        {item.fileType !== 'LINK' && !item.linkUrl && (
                          <button type="button" onClick={() => handleDownload(item)} disabled={busyId === item.id}>
                            {busyId === item.id ? 'Downloading...' : 'Download'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ActivityShell>
  );
}
