import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import { deleteReference, getReferences } from '../api';
import { getEvidence } from '../../evidence/api';
import { ACCREDITATION_AREAS, ACTIVITY_WRITE_ROLES, DEPARTMENTS, OFFICES, formatAccreditationArea } from '../../activities/constants';
import { useAuth } from '../../../shared/hooks/useAuth';
import '../SharedEvidence.css';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceReferencesPage() {
  const { evidenceId } = useParams();
  const { user } = useAuth();

  const [evidence, setEvidence] = useState(null);
  const [evidenceError, setEvidenceError] = useState('');

  const [refs, setRefs] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const [filterDept, setFilterDept] = useState('');
  const [filterArea, setFilterArea] = useState('');

  useEffect(() => {
    getEvidence(evidenceId)
      .then(({ data }) => setEvidence(data))
      .catch(() => setEvidenceError('Evidence file not found.'));
  }, [evidenceId]);

  const loadRefs = useCallback(async (page = 0) => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      const params = { page, size: 20 };
      if (filterDept) params.department = filterDept;
      if (filterArea) params.area = filterArea;

      const { data } = await getReferences(evidenceId, params);
      setRefs(data.content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setCurrentPage(data.number);
    } catch (err) {
      if (err.response?.status === 400) {
        setAccessDenied(true);
      } else {
        setError(err.response?.data?.error || 'Failed to load references.');
      }
    } finally {
      setLoading(false);
    }
  }, [evidenceId, filterDept, filterArea]);

  useEffect(() => {
    loadRefs(0);
  }, [loadRefs]);

  const isOwner = evidence && user && evidence.uploadedById === user.id;
  const canRemoveReferences = user && ACTIVITY_WRITE_ROLES.includes(user.role);

  const uniqueOffices = [...new Set(refs.map((r) => r.referencedByOffice || r.referencedByDepartment).filter(Boolean))].length;
  const uniqueAreas = [...new Set(refs.map((r) => r.accreditationArea).filter(Boolean))].length;
  const officeOptions = [...DEPARTMENTS, ...OFFICES];

  return (
    <ActivityShell>
      <p className="am-breadcrumb">
        Workspace / <Link to="/shared-evidence">Shared Evidence</Link>
        {evidence && <> / {evidence.originalFileName}</>}
        {' / References'}
      </p>

      <div className="am-page-header">
        <h1 className="am-page-title">Shared Evidence Details</h1>
        <div className="am-page-actions">
          <Link className="am-btn-secondary" to="/shared-evidence">Back to Shared Evidence</Link>
        </div>
      </div>

      {evidenceError && <p className="am-alert am-alert-error">{evidenceError}</p>}
      {error && <p className="am-alert am-alert-error">{error}</p>}

      {accessDenied && (
        <p className="am-alert am-alert-error">
          Unable to load reference details for this file.
        </p>
      )}

      {!accessDenied && (
        <div className="se-ref-layout">
          {/* Left: file info + usage */}
          <div className="se-ref-left">
            {evidence && (
              <div className="se-ref-file-panel">
                <p className="am-section-label" style={{ marginBottom: '0.5rem' }}>Evidence Details</p>

                {isOwner && (
                  <span className="se-owner-badge">You uploaded this</span>
                )}

                <div className="se-ref-preview">[ {evidence.fileType} PREVIEW ]</div>

                <p className="se-ref-fname">{evidence.originalFileName}</p>
                <p className="se-ref-fmeta">
                  {formatFileSize(evidence.fileSize)} · {evidence.uploadedByName || 'Unknown'}
                </p>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <a
                    className="am-btn-secondary"
                    href={`http://localhost:8080/api/evidence/${evidenceId}/view`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Evidence
                  </a>
                  <a
                    className="am-btn-secondary"
                    href={`http://localhost:8080/api/evidence/${evidenceId}/download`}
                  >
                    Download
                  </a>
                </div>

                <div className="se-meta-list" style={{ marginTop: '0.75rem' }}>
                  <div className="se-meta-row">
                    <span className="se-meta-key">Source</span>
                    <span className="se-meta-val">{evidence.activityName || '-'}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">Office</span>
                    <span className="se-meta-val">{evidence.ownerOffice || evidence.uploadedByDepartment || '-'}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">Area</span>
                    <span className="se-meta-val">{formatAccreditationArea(evidence.accreditationArea)}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">AY</span>
                    <span className="se-meta-val">{evidence.academicYear || '-'}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">Uploaded</span>
                    <span className="se-meta-val">{formatDate(evidence.uploadedAt)}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">Uploaded By</span>
                    <span className="se-meta-val">{evidence.uploadedByName || '-'}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">Evidence</span>
                    <span className="se-meta-val">{evidence.evidenceType || '-'}</span>
                  </div>
                  <div className="se-meta-row">
                    <span className="se-meta-key">References</span>
                    <span className="se-meta-val">{totalElements}</span>
                  </div>
                  {evidence.tags?.length > 0 && (
                    <div className="se-meta-row">
                      <span className="se-meta-key">Tags</span>
                      <span className="se-meta-val">{evidence.tags.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* TODO: notify referencing departments of updates — notifications phase */}
              </div>
            )}

            <div className="se-usage-panel">
              <p className="am-section-label" style={{ marginBottom: '0.5rem' }}>Usage</p>
              <div className="se-usage-count">{totalElements}</div>
              <p className="se-usage-label">
                Total references<br />
                across {uniqueOffices} {uniqueOffices === 1 ? 'office' : 'offices'} · {uniqueAreas} {uniqueAreas === 1 ? 'area' : 'areas'}
              </p>
            </div>
          </div>

          {/* Right: stats + table */}
          <div>
            {!loading && totalElements > 0 && (
              <div className="se-stats-bar">
                <div className="se-stat-chip">
                  <span className="se-stat-num">{uniqueOffices}</span>
                  <span className="se-stat-lbl">Offices</span>
                </div>
                <div className="se-stat-chip">
                  <span className="se-stat-num">{totalElements}</span>
                  <span className="se-stat-lbl">Activities</span>
                </div>
                <div className="se-stat-chip">
                  <span className="se-stat-num">{uniqueAreas}</span>
                  <span className="se-stat-lbl">Areas</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <select
                className="am-select"
                style={{ maxWidth: 180 }}
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="">All offices</option>
                {officeOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                className="am-select"
                style={{ maxWidth: 180 }}
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
              >
                <option value="">All areas</option>
                {ACCREDITATION_AREAS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            <p className="am-section-label" style={{ marginBottom: '0.5rem' }}>
              Referenced By{' '}
              <span className="am-count">{totalElements} references</span>
            </p>

            <table className="se-table">
              <thead>
                <tr>
                  <th className="se-th">Office</th>
                  <th className="se-th">Related Activity</th>
                  <th className="se-th">Area Used</th>
                  <th className="se-th">Date Referenced</th>
                  <th className="se-th">By User</th>
                  <th className="se-th"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td className="am-empty" colSpan={6}>Loading references…</td></tr>
                )}
                {!loading && refs.length === 0 && (
                  <tr>
                    <td className="am-empty" colSpan={6}>
                      Not yet referenced by any activity.
                    </td>
                  </tr>
                )}
                {refs.map((ref) => (
                  <tr key={ref.id}>
                    <td className="se-td" style={{ fontWeight: 600 }}>{ref.referencedByOffice || ref.referencedByDepartment || '-'}</td>
                    <td className="se-td">{ref.activityName || '-'}</td>
                    <td className="se-td">
                      {ref.accreditationArea
                        ? <span className="am-type-badge">{formatAccreditationArea(ref.accreditationArea)}</span>
                        : '-'}
                    </td>
                    <td className="se-td">{formatDate(ref.createdAt)}</td>
                    <td className="se-td">{ref.referencedByName || '-'}</td>
                    <td className="se-td">
                      <Link
                        className="am-link-button"
                        to={`/activities/${ref.activityId}`}
                      >
                        Activity
                      </Link>
                      {canRemoveReferences && (
                        <button
                          className="am-link-button am-link-danger"
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('Remove this reference? The original evidence file will remain.')) return;
                            await deleteReference(ref.id);
                            loadRefs(currentPage);
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button
                  className="am-btn-secondary"
                  type="button"
                  onClick={() => loadRefs(currentPage - 1)}
                  disabled={currentPage === 0 || loading}
                >
                  Prev
                </button>
                <span style={{ padding: '0.4rem 0.6rem', fontSize: '0.72rem', color: '#6b7280' }}>
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  className="am-btn-secondary"
                  type="button"
                  onClick={() => loadRefs(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1 || loading}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </ActivityShell>
  );
}
