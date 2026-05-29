import { useCallback, useEffect, useState } from 'react';
import ActivityShell from '../../activities/components/ActivityShell';
import {
  ACTIVITY_WRITE_ROLES,
  ACCREDITATION_AREAS,
  DEPARTMENTS,
  OFFICES,
  formatAccreditationArea,
  formatDepartment,
  formatOffice,
} from '../../activities/constants';
import { listActivities } from '../../activities/api';
import { useAuth } from '../../../shared/hooks/useAuth';
import Modal from '../../../shared/components/Modal';
import ActionMenu from '../../../shared/components/ActionMenu';
import ReferenceConfirmModal from '../../shared-evidence/components/ReferenceConfirmModal';
import GenerateAccreditorAccessModal from '../../accreditor-access/components/GenerateAccreditorAccessModal';
import {
  downloadEvidenceBlob,
  getEvidence,
  getEvidenceViewUrl,
} from '../../evidence/api';
import {
  EVIDENCE_TYPES,
  formatEvidenceType,
  formatRelatedOffice,
} from '../../evidence/constants';
import { searchRepository } from '../api';
import '../Repository.css';

const ACADEMIC_YEARS = ['2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027'];
const ALL_OFFICES = [...DEPARTMENTS, ...OFFICES];
const PREVIEW_TYPES = ['PDF', 'JPG', 'JPEG', 'PNG'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ownerOffice(item) {
  if (item?.office) return formatOffice(item.office);
  if (item?.department) return formatDepartment(item.department);
  return '-';
}

function activityOwnerLabel(activity) {
  if (activity?.office) return formatOffice(activity.office);
  if (activity?.department) return formatDepartment(activity.department);
  return 'No office';
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

export default function RepositoryPage() {
  const { user } = useAuth();
  const canReference = user && ACTIVITY_WRITE_ROLES.includes(user.role);

  const [keyword, setKeyword] = useState('');
  const [area, setArea] = useState('');
  const [office, setOffice] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [evidenceType, setEvidenceType] = useState('');

  const [results, setResults] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activities, setActivities] = useState([]);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evidenceDetails, setEvidenceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [targetActivityId, setTargetActivityId] = useState('');
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [accreditorAccessOpen, setAccreditorAccessOpen] = useState(false);
  const [busyDownloadId, setBusyDownloadId] = useState('');

  const doSearch = useCallback(async (page = 0) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: 20 };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (area) params.areas = area;
      if (office) params.department = office;
      if (academicYear) params.academicYear = academicYear;
      if (evidenceType) params.evidenceTypes = evidenceType;

      const { data } = await searchRepository(params);
      setResults(data.content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setCurrentPage(data.number);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load repository evidence.');
    } finally {
      setLoading(false);
    }
  }, [keyword, area, office, academicYear, evidenceType]);

  useEffect(() => {
    doSearch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listActivities()
      .then(({ data }) => setActivities(data))
      .catch(() => setActivities([]));
  }, []);

  const handleApply = (e) => {
    e?.preventDefault();
    doSearch(0);
  };

  const handleClear = () => {
    setKeyword('');
    setArea('');
    setOffice('');
    setAcademicYear('');
    setEvidenceType('');
  };

  const openDetails = async (item, openReference = false) => {
    setSelectedEvidence(item);
    setEvidenceDetails(null);
    setTargetActivityId('');
    setDetailsLoading(true);
    try {
      const { data } = await getEvidence(item.id);
      setEvidenceDetails(data);
    } catch {
      setEvidenceDetails(null);
    } finally {
      setDetailsLoading(false);
    }
    if (openReference) {
      window.setTimeout(() => {
        const el = document.getElementById('repo-reference-target');
        el?.focus();
      }, 0);
    }
  };

  const closeDetails = () => {
    setSelectedEvidence(null);
    setEvidenceDetails(null);
    setTargetActivityId('');
    setReferenceModalOpen(false);
    setAccreditorAccessOpen(false);
  };

  const handleDownload = async (item) => {
    setBusyDownloadId(item.id);
    setError('');
    try {
      const { data } = await downloadEvidenceBlob(item.id);
      saveBlob(data, item.originalFileName);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download evidence.');
    } finally {
      setBusyDownloadId('');
    }
  };

  const handleReferenceSuccess = () => {
    setReferenceModalOpen(false);
    closeDetails();
    doSearch(currentPage);
  };

  const targetActivity = activities.find((activity) => activity.id === targetActivityId);
  const detail = evidenceDetails || selectedEvidence;
  const pageStart = totalElements === 0 ? 0 : currentPage * 20 + 1;
  const pageEnd = Math.min((currentPage + 1) * 20, totalElements);

  const isDeptStaff = user?.role === 'DEPT_STAFF';

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Repository</p>
      <div className="am-page-header">
        <div>
          <h1 className="am-page-title">Repository</h1>
          <p className="repo-page-context">
            {isDeptStaff
              ? 'Showing your department’s uploads and files referenced to your department.'
              : 'Global evidence explorer for finding reusable evidence before uploading duplicates.'}
          </p>
        </div>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      <div className="repo-layout">
        <aside className="repo-filter-panel">
          <p className="repo-filter-heading">Filters</p>

          <form className="repo-filter-form" onSubmit={handleApply}>
            <div className="repo-filter-section">
              <p className="repo-filter-label">Search Keyword</p>
              <input
                className="am-input"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="File, activity, tags"
              />
            </div>

            <div className="repo-filter-section">
              <p className="repo-filter-label">Accreditation Area</p>
              <select className="am-select" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">All areas</option>
                {ACCREDITATION_AREAS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {!isDeptStaff && (
              <div className="repo-filter-section">
                <p className="repo-filter-label">Owner Office</p>
                <select className="am-select" value={office} onChange={(e) => setOffice(e.target.value)}>
                  <option value="">All offices</option>
                  {ALL_OFFICES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="repo-filter-section">
              <p className="repo-filter-label">Academic Year</p>
              <select className="am-select" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                <option value="">All years</option>
                {ACADEMIC_YEARS.map((year) => (
                  <option key={year} value={year}>AY {year}</option>
                ))}
              </select>
            </div>

            <div className="repo-filter-section">
              <p className="repo-filter-label">Evidence Type</p>
              <select className="am-select" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                <option value="">All types</option>
                {EVIDENCE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="repo-filter-actions">
              <button className="am-btn-secondary" type="button" onClick={handleClear}>Clear</button>
              <button className="am-btn-primary" type="submit" disabled={loading}>Apply</button>
            </div>
          </form>
        </aside>

        <div className="repo-results-area">
          <div className="repo-results-header">
            <p className="am-section-label">
              Evidence Results <span className="repo-results-count">{totalElements} total</span>
            </p>
            {totalElements > 0 && (
              <span className="repo-results-count">
                {pageStart}-{pageEnd} of {totalElements}
              </span>
            )}
          </div>

          <table className="se-table">
            <thead>
              <tr>
                <th className="se-th">File Name</th>
                <th className="se-th">Source Activity</th>
                <th className="se-th">Owner Office</th>
                <th className="se-th">Accreditation Area</th>
                <th className="se-th">Evidence Type</th>
                <th className="se-th">Reference Count</th>
                <th className="se-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="am-empty" colSpan={7}>Searching repository...</td></tr>
              )}
              {!loading && results.length === 0 && (
                <tr><td className="am-empty" colSpan={7}>No evidence found.</td></tr>
              )}
              {!loading && results.map((item) => (
                <tr key={item.id}>
                  <td className="se-td">
                    <div className="se-td-file">
                      <span className="se-file-icon">{item.fileType}</span>
                      <span className="se-file-name">{item.originalFileName}</span>
                    </div>
                  </td>
                  <td className="se-td">{item.activityName || '-'}</td>
                  <td className="se-td">
                    <span>{ownerOffice(item)}</span>
                    {item.referencedToViewer && (
                      <span className="repo-referenced-badge">Referenced</span>
                    )}
                  </td>
                  <td className="se-td">
                    <span className="am-type-badge">{formatAccreditationArea(item.accreditationArea)}</span>
                  </td>
                  <td className="se-td">{formatEvidenceType(item.evidenceType)}</td>
                  <td className="se-td">
                    <span className="se-refs-count">{item.referenceCount}</span>
                  </td>
                  <td className="se-td">
                    <div className="repo-row-actions">
                      <button className="am-link-button" type="button" onClick={() => openDetails(item)}>
                        View Details
                      </button>
                      <ActionMenu
                        items={[
                          canReference && {
                            label: 'Reference Evidence',
                            onClick: () => openDetails(item, true),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="repo-pagination">
              <span className="repo-page-info">{pageStart}-{pageEnd} of {totalElements}</span>
              <div className="repo-page-buttons">
                <button onClick={() => doSearch(currentPage - 1)} disabled={currentPage === 0 || loading}>Prev</button>
                <span className="repo-page-info">Page {currentPage + 1} of {totalPages}</span>
                <button onClick={() => doSearch(currentPage + 1)} disabled={currentPage >= totalPages - 1 || loading}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(selectedEvidence)} onClose={closeDetails} title="Evidence Details" size="wide">
        {detail && (
          <div className="repo-details">
            {detailsLoading && <p className="am-empty am-empty-plain">Loading details...</p>}

            <div className="repo-details-main">
              <div>
                <p className="am-section-label">File</p>
                <h2 className="repo-details-title">{detail.originalFileName}</h2>
                <p className="repo-details-sub">
                  {detail.fileType} - {formatFileSize(detail.fileSize)}
                </p>

                <div className="repo-details-actions">
                  {PREVIEW_TYPES.includes(detail.fileType) && (
                    <a
                      className="am-btn-secondary"
                      href={getEvidenceViewUrl(detail.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Details
                    </a>
                  )}
                  <ActionMenu
                    items={[
                      {
                        label: busyDownloadId === detail.id ? 'Downloading...' : 'Download',
                        disabled: busyDownloadId === detail.id,
                        onClick: () => handleDownload(detail),
                      },
                      canReference && {
                        label: 'Generate Accreditor Access',
                        onClick: () => setAccreditorAccessOpen(true),
                      },
                    ]}
                  />
                </div>
              </div>

              <dl className="repo-details-list">
                <div>
                  <dt>Source Activity</dt>
                  <dd>{detail.activityName || '-'}</dd>
                </div>
                <div>
                  <dt>Owner Office</dt>
                  <dd>{ownerOffice(detail)}</dd>
                </div>
                <div>
                  <dt>Uploaded By</dt>
                  <dd>{detail.uploadedByName || '-'}</dd>
                </div>
                <div>
                  <dt>Accreditation Area</dt>
                  <dd>{formatAccreditationArea(detail.accreditationArea)}</dd>
                </div>
                <div>
                  <dt>Academic Year</dt>
                  <dd>{detail.academicYear || '-'}</dd>
                </div>
                <div>
                  <dt>Evidence Type</dt>
                  <dd>{formatEvidenceType(detail.evidenceType)}</dd>
                </div>
                <div>
                  <dt>Reference Count</dt>
                  <dd>{selectedEvidence.referenceCount ?? 0}</dd>
                </div>
                <div>
                  <dt>Related Offices</dt>
                  <dd>{detail.relatedOffices?.length ? detail.relatedOffices.map(formatRelatedOffice).join(', ') : '-'}</dd>
                </div>
                <div>
                  <dt>Tags</dt>
                  <dd>{detail.tags?.length ? detail.tags.join(', ') : '-'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{detail.notes || '-'}</dd>
                </div>
              </dl>
            </div>

            {canReference && (
              <div className="repo-details-reference">
                <p className="am-section-label">Reference Evidence</p>
                <div className="repo-reference-row">
                  <select
                    id="repo-reference-target"
                    className="am-select"
                    value={targetActivityId}
                    onChange={(e) => setTargetActivityId(e.target.value)}
                  >
                    <option value="">Select target activity</option>
                    {activities
                      .filter((activity) => activity.id !== detail.activityId)
                      .map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.activityName} - {activityOwnerLabel(activity)}
                        </option>
                      ))}
                  </select>
                  <button
                    className="am-btn-primary"
                    type="button"
                    disabled={!targetActivity}
                    onClick={() => setReferenceModalOpen(true)}
                  >
                    Reference Evidence
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {detail && targetActivity && (
        <ReferenceConfirmModal
          evidence={detail}
          activity={targetActivity}
          isOpen={referenceModalOpen}
          onClose={() => setReferenceModalOpen(false)}
          onSuccess={handleReferenceSuccess}
        />
      )}

      {detail && (
        <GenerateAccreditorAccessModal
          isOpen={accreditorAccessOpen}
          onClose={() => setAccreditorAccessOpen(false)}
          evidenceIds={[detail.id]}
        />
      )}
    </ActivityShell>
  );
}
