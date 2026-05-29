import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  downloadPublicEvidenceBlob,
  getPublicAccreditorAccess,
  getPublicEvidenceViewUrl,
} from '../api';
import { formatAccreditationArea, formatDepartment, formatOffice } from '../../activities/constants';
import { formatEvidenceType } from '../../evidence/constants';
import '../AccreditorAccess.css';

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

export default function AccreditorAccessPage() {
  const { token } = useParams();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getPublicAccreditorAccess(token)
      .then(({ data }) => setAccess(data))
      .catch(() => setError('Access link is invalid or expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async (item) => {
    setBusyId(item.id);
    setError('');
    try {
      const { data } = await downloadPublicEvidenceBlob(token, item.id);
      saveBlob(data, item.originalFileName);
    } catch {
      setError('Unable to download this evidence file.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="aa-public-shell">
      <header className="aa-public-header">
        <div>
          <div className="aa-logo">AERCS</div>
          <h1>Accreditor Evidence Access</h1>
          <p>Read-only evidence files shared for accreditation review.</p>
        </div>
        {access?.expiresAt && (
          <span className="aa-expiry">Expires {new Date(access.expiresAt).toLocaleString()}</span>
        )}
      </header>

      <main className="aa-public-main">
        {loading && <div className="aa-empty">Loading access link...</div>}
        {error && <div className="aa-error">{error}</div>}

        {!loading && !error && access && (
          <>
            {access.notes && <p className="aa-notes">{access.notes}</p>}

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
                  <tr><td colSpan={7} className="aa-empty">No evidence is available for this access link.</td></tr>
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
                        {PREVIEW_TYPES.includes(item.fileType) && (
                          <a
                            href={getPublicEvidenceViewUrl(token, item.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        )}
                        <button type="button" onClick={() => handleDownload(item)} disabled={busyId === item.id}>
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}
