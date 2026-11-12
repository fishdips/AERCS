import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import { getMyAccreditorLink } from '../api';
import { formatAccreditationArea, formatDepartment, formatOffice } from '../../activities/constants';
import { formatEvidenceType } from '../../evidence/constants';
import '../AccreditorAccess.css';
import { Eye, ExternalLink } from 'lucide-react';
import Icon from '../../../shared/components/Icon';
import Alert from '../../../shared/components/Alert';

// Loaded on demand so the document renderers is only downloaded when an accreditor opens a file.
const SecureEvidenceViewer = lazy(() => import('../components/SecureEvidenceViewer'));

const PREVIEW_TYPES = ['PDF', 'JPG', 'JPEG', 'PNG', 'DOCX', 'XLSX'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_TYPE_LABELS = { LINK: 'Links' };

function typeLabel(fileType) {
  return FILE_TYPE_LABELS[fileType] || fileType;
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
  const [viewing, setViewing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [activityFilter, setActivityFilter] = useState('ALL');

  const fetchLink = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    getMyAccreditorLink(id)
      .then(({ data }) => setAccess(data))
      .catch(() => {
        if (!silent) {
          setError('This evidence link is unavailable. It may have expired or was not shared with your account.');
        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    setTypeFilter('ALL');
    setActivityFilter('ALL');
    fetchLink(false);
  }, [id, fetchLink]);

  useEffect(() => {
    const handleFocus = () => fetchLink(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchLink(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchLink]);

  const evidence = access?.evidence;

  // Only the file types and activities that actually exist in this link are offered as filters.
  const typeCounts = useMemo(() => {
    const counts = new Map();
    (evidence || []).forEach((item) => counts.set(item.fileType, (counts.get(item.fileType) || 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [evidence]);

  const activities = useMemo(
    () => [...new Set((evidence || []).map((item) => item.sourceActivity).filter(Boolean))].sort(),
    [evidence],
  );

  const visibleEvidence = useMemo(
    () => (evidence || []).filter((item) => (
      (typeFilter === 'ALL' || item.fileType === typeFilter)
      && (activityFilter === 'ALL' || item.sourceActivity === activityFilter)
    )),
    [evidence, typeFilter, activityFilter],
  );

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
      <Alert type="error" message={error} onDismiss={() => setError('')} />

      {!loading && access && (
        <>
          {access.notes && <p className="aa-notes">{access.notes}</p>}

          {access.evidence.length > 0 && (
            <div className="aa-filters">
              <div className="aa-filter-types" role="group" aria-label="Filter by file type">
                <button
                  type="button"
                  className={`aa-filter-chip${typeFilter === 'ALL' ? ' aa-filter-chip-active' : ''}`}
                  onClick={() => setTypeFilter('ALL')}
                >
                  All ({access.evidence.length})
                </button>
                {typeCounts.map(([fileType, count]) => (
                  <button
                    key={fileType}
                    type="button"
                    className={`aa-filter-chip${typeFilter === fileType ? ' aa-filter-chip-active' : ''}`}
                    onClick={() => setTypeFilter(fileType)}
                  >
                    {typeLabel(fileType)} ({count})
                  </button>
                ))}
              </div>
              {activities.length > 1 && (
                <select
                  className="am-input aa-filter-activity"
                  value={activityFilter}
                  onChange={(event) => setActivityFilter(event.target.value)}
                  aria-label="Filter by activity"
                >
                  <option value="ALL">All activities</option>
                  {activities.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              )}
            </div>
          )}

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
                {access.evidence.length > 0 && visibleEvidence.length === 0 && (
                  <tr><td colSpan={7} className="aa-empty">No files match the selected filters.</td></tr>
                )}
                {visibleEvidence.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="am-evidence-name-row">
                        <strong>{item.originalFileName}</strong>
                        {item.fileType !== 'LINK' && !item.linkUrl && (
                          <span className={`am-version-badge ${(item.currentVersion || 1) > 1 ? 'am-version-badge-multi' : ''}`}>
                            v{item.currentVersion || 1}
                          </span>
                        )}
                      </div>
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
                          <a className="am-link-button" href={item.linkUrl} target="_blank" rel="noreferrer">
                            <Icon as={ExternalLink} /> Open Link
                          </a>
                        )}
                        {PREVIEW_TYPES.includes(item.fileType) && (
                          <button className="am-link-button" type="button" onClick={() => setViewing(item)}>
                            <Icon as={Eye} /> View
                          </button>
                        )}
                        {item.fileType !== 'LINK' && !item.linkUrl && !PREVIEW_TYPES.includes(item.fileType) && (
                          <span className="aa-view-only">Preview not available</span>
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

      {viewing && (
        <Suspense fallback={null}>
          <SecureEvidenceViewer
            linkId={id}
            evidence={viewing}
            onClose={() => setViewing(null)}
          />
        </Suspense>
      )}
    </ActivityShell>
  );
}
