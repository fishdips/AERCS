import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  downloadPublicEvidenceBlob,
  getPublicAccreditorAccess,
  getPublicEvidenceViewUrl,
  requestAccreditorOtp,
  verifyAccreditorOtp,
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
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    getPublicAccreditorAccess(token)
      .then(({ data }) => setAccess(data))
      .catch(async (err) => {
        if (err.response?.status === 403) {
          setVerificationRequired(true);
          try {
            await requestAccreditorOtp(token);
            setOtpSent(true);
          } catch (otpError) {
            setError(otpError.response?.data?.error || 'Unable to send the verification code.');
          }
        } else {
          setError('Access link is invalid or expired.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleRequestOtp = async () => {
    setOtpBusy(true);
    setError('');
    try {
      await requestAccreditorOtp(token);
      setOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send the verification code.');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setOtpBusy(true);
    setError('');
    try {
      const { data } = await verifyAccreditorOtp(token, otp);
      setAccess(data);
      setVerificationRequired(false);
    } catch (err) {
      setError(err.response?.data?.error || 'The verification code is invalid or expired.');
    } finally {
      setOtpBusy(false);
    }
  };

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

        {!loading && verificationRequired && !access && (
          <section className="aa-verification">
            <h2>Verify accreditor access</h2>
            <p>
              {otpSent
                ? 'A one-time verification code was sent to the invited email address.'
                : 'Sending a one-time verification code to the invited email address...'}
            </p>
            <form onSubmit={handleVerifyOtp}>
              <label htmlFor="aa-otp">6-digit verification code</label>
              <input
                id="aa-otp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <button type="submit" disabled={otpBusy || !otpSent}>
                {otpBusy ? 'Verifying...' : 'Verify and view evidence'}
              </button>
              <button type="button" onClick={handleRequestOtp} disabled={otpBusy}>
                Resend code
              </button>
            </form>
          </section>
        )}

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
                        {(item.fileType === 'LINK' || item.linkUrl) && (
                          <a
                            href={item.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            🔗 Open Link
                          </a>
                        )}
                        {PREVIEW_TYPES.includes(item.fileType) && (
                          <a
                            href={getPublicEvidenceViewUrl(token, item.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        )}
                        {item.fileType !== 'LINK' && !item.linkUrl && (
                          <button type="button" onClick={() => handleDownload(item)} disabled={busyId === item.id}>
                            Download
                          </button>
                        )}
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
