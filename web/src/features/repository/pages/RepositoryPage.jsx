import { useCallback, useEffect, useState } from 'react';
import ActivityShell from '../../activities/components/ActivityShell';
import {
  ACCREDITATION_AREAS,
  ACTIVITY_TYPES,
  DEPARTMENTS,
  OFFICES,
  formatAccreditationArea,
  formatActivityType,
} from '../../activities/constants';
import { listActivities } from '../../activities/api';
import ReferenceConfirmModal from '../../shared-evidence/components/ReferenceConfirmModal';
import { searchRepository } from '../api';
import '../Repository.css';

const FILE_TYPES = ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG'];

const ACADEMIC_YEARS = ['2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027'];

const ALL_OFFICES = [...DEPARTMENTS, ...OFFICES];

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current < 4) return [0, 1, 2, 3, '...', total - 1];
  if (current > total - 5) return [0, '...', total - 4, total - 3, total - 2, total - 1];
  return [0, '...', current - 1, current, current + 1, '...', total - 1];
}

export default function RepositoryPage() {
  const [keyword, setKeyword] = useState('');
  const [selectedAreas, setSelectedAreas] = useState(new Set());
  const [office, setOffice] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [selectedActivityTypes, setSelectedActivityTypes] = useState(new Set());
  const [selectedFileTypes, setSelectedFileTypes] = useState(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [results, setResults] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [appliedChips, setAppliedChips] = useState(null);
  const [activities, setActivities] = useState([]);
  const [referenceEvidence, setReferenceEvidence] = useState(null);
  const [targetActivityId, setTargetActivityId] = useState('');
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);

  const doSearch = useCallback(async (filters, page = 0) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: 20 };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.areas.size > 0) params.areas = [...filters.areas].join(',');
      if (filters.office) params.department = filters.office;
      if (filters.academicYear) params.academicYear = filters.academicYear;
      if (filters.activityTypes.size > 0) params.activityTypes = [...filters.activityTypes].join(',');
      if (filters.fileTypes.size > 0) params.fileTypes = [...filters.fileTypes].join(',');
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const { data } = await searchRepository(params);
      setResults(data.content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setCurrentPage(data.number);
      setAppliedChips({ ...filters, areas: new Set(filters.areas), activityTypes: new Set(filters.activityTypes), fileTypes: new Set(filters.fileTypes) });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch({ keyword: '', areas: new Set(), office: '', academicYear: '', activityTypes: new Set(), fileTypes: new Set(), dateFrom: '', dateTo: '' }, 0);
  }, [doSearch]);

  useEffect(() => {
    listActivities()
      .then(({ data }) => setActivities(data))
      .catch(() => setActivities([]));
  }, []);

  const getFilters = () => ({
    keyword: keyword.trim(),
    areas: new Set(selectedAreas),
    office,
    academicYear,
    activityTypes: new Set(selectedActivityTypes),
    fileTypes: new Set(selectedFileTypes),
    dateFrom,
    dateTo,
  });

  const handleApply = (e) => {
    e?.preventDefault();
    doSearch(getFilters(), 0);
  };

  const handlePageChange = (page) => {
    if (!appliedChips) return;
    doSearch(appliedChips, page);
  };

  const handleClear = () => {
    setKeyword('');
    setSelectedAreas(new Set());
    setOffice('');
    setAcademicYear('');
    setSelectedActivityTypes(new Set());
    setSelectedFileTypes(new Set());
    setDateFrom('');
    setDateTo('');
  };

  const toggleArea = (value) => {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  const toggleActivityType = (value) => {
    setSelectedActivityTypes((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  const toggleFileType = (value) => {
    setSelectedFileTypes((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  const removeChip = (update) => {
    const f = {
      keyword: appliedChips.keyword,
      areas: new Set(appliedChips.areas),
      office: appliedChips.office,
      academicYear: appliedChips.academicYear,
      activityTypes: new Set(appliedChips.activityTypes),
      fileTypes: new Set(appliedChips.fileTypes),
      dateFrom: appliedChips.dateFrom,
      dateTo: appliedChips.dateTo,
    };
    if (update.removeArea) { f.areas.delete(update.removeArea); setSelectedAreas(new Set(f.areas)); }
    if (update.clearOffice) { f.office = ''; setOffice(''); }
    if (update.clearAcademicYear) { f.academicYear = ''; setAcademicYear(''); }
    if (update.removeActivityType) { f.activityTypes.delete(update.removeActivityType); setSelectedActivityTypes(new Set(f.activityTypes)); }
    if (update.removeFileType) { f.fileTypes.delete(update.removeFileType); setSelectedFileTypes(new Set(f.fileTypes)); }
    if (update.clearKeyword) { f.keyword = ''; setKeyword(''); }
    if (update.clearDateFrom) { f.dateFrom = ''; setDateFrom(''); }
    if (update.clearDateTo) { f.dateTo = ''; setDateTo(''); }
    doSearch(f, 0);
  };

  const hasChips = appliedChips && (
    appliedChips.keyword ||
    appliedChips.areas.size > 0 ||
    appliedChips.office ||
    appliedChips.academicYear ||
    appliedChips.activityTypes.size > 0 ||
    appliedChips.fileTypes.size > 0 ||
    appliedChips.dateFrom ||
    appliedChips.dateTo
  );

  const pageStart = totalElements === 0 ? 0 : currentPage * 20 + 1;
  const pageEnd = Math.min((currentPage + 1) * 20, totalElements);
  const targetActivity = activities.find((activity) => activity.id === targetActivityId);

  const openReferenceFlow = (item) => {
    setReferenceEvidence(item);
    setTargetActivityId('');
  };

  const handleReferenceSuccess = () => {
    setReferenceEvidence(null);
    setTargetActivityId('');
    if (appliedChips) doSearch(appliedChips, currentPage);
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Repository</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Search Repository</h1>
        <div className="am-page-actions">
          <button className="am-btn-primary" type="button" onClick={handleApply} disabled={loading}>
            Apply Filters
          </button>
        </div>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      <div className="repo-layout">

        {/* ── Left: filter panel ─────────────────────────────────────────── */}
        <aside className="repo-filter-panel">
          <p className="repo-filter-heading">Filters</p>

          <div className="repo-filter-section">
            <p className="repo-filter-label">Accreditation Area</p>
            {ACCREDITATION_AREAS.map((area) => (
              <label key={area.value} className="repo-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedAreas.has(area.value)}
                  onChange={() => toggleArea(area.value)}
                />
                {area.label}
              </label>
            ))}
          </div>

          <div className="repo-filter-section">
            <p className="repo-filter-label">Office</p>
            <select className="am-select" value={office} onChange={(e) => setOffice(e.target.value)}>
              <option value="">All offices</option>
              {ALL_OFFICES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="repo-filter-section">
            <p className="repo-filter-label">Academic Year</p>
            <select className="am-select" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              <option value="">All years</option>
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>AY {y}</option>
              ))}
            </select>
          </div>

          <div className="repo-filter-section">
            <p className="repo-filter-label">Activity Type</p>
            {ACTIVITY_TYPES.map((type) => (
              <label key={type.value} className="repo-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedActivityTypes.has(type.value)}
                  onChange={() => toggleActivityType(type.value)}
                />
                {type.label}
              </label>
            ))}
          </div>

          <div className="repo-filter-section">
            <p className="repo-filter-label">Date Uploaded</p>
            <div className="repo-date-row">
              <input
                className="am-input repo-date-input"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="repo-date-sep">–</span>
              <input
                className="am-input repo-date-input"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="repo-filter-section">
            <p className="repo-filter-label">File Type</p>
            <div className="se-file-type-row">
              {FILE_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  className={`se-file-type-btn ${selectedFileTypes.has(ft) ? 'active' : ''}`}
                  onClick={() => toggleFileType(ft)}
                >
                  {ft}
                </button>
              ))}
            </div>
          </div>

          <div className="repo-filter-actions">
            <button className="am-btn-secondary" type="button" onClick={handleClear}>Clear</button>
            <button className="am-btn-primary" type="button" onClick={handleApply} disabled={loading}>Apply</button>
          </div>
        </aside>

        {/* ── Right: search + results ────────────────────────────────────── */}
        <div className="repo-results-area">

          <form className="repo-search-bar" onSubmit={handleApply}>
            <input
              className="repo-search-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='Search files, activities, tags…'
            />
            <button className="am-btn-primary" type="submit" disabled={loading}>Search</button>
          </form>

          {hasChips && (
            <div className="repo-chips">
              {[...appliedChips.areas].map((a) => (
                <span key={a} className="repo-chip">
                  AREA: {formatAccreditationArea(a)}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ removeArea: a })}>×</button>
                </span>
              ))}
              {appliedChips.office && (
                <span className="repo-chip">
                  OFFICE: {appliedChips.office}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ clearOffice: true })}>×</button>
                </span>
              )}
              {appliedChips.academicYear && (
                <span className="repo-chip">
                  AY {appliedChips.academicYear}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ clearAcademicYear: true })}>×</button>
                </span>
              )}
              {[...appliedChips.activityTypes].map((t) => (
                <span key={t} className="repo-chip">
                  {formatActivityType(t)}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ removeActivityType: t })}>×</button>
                </span>
              ))}
              {[...appliedChips.fileTypes].map((ft) => (
                <span key={ft} className="repo-chip">
                  {ft}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ removeFileType: ft })}>×</button>
                </span>
              ))}
              {appliedChips.keyword && (
                <span className="repo-chip">
                  "{appliedChips.keyword}"
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ clearKeyword: true })}>×</button>
                </span>
              )}
              {appliedChips.dateFrom && (
                <span className="repo-chip">
                  FROM {appliedChips.dateFrom}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ clearDateFrom: true })}>×</button>
                </span>
              )}
              {appliedChips.dateTo && (
                <span className="repo-chip">
                  TO {appliedChips.dateTo}
                  <button className="repo-chip-remove" type="button" onClick={() => removeChip({ clearDateTo: true })}>×</button>
                </span>
              )}
            </div>
          )}

          <>
              <div className="repo-results-header">
                <p className="am-section-label">
                  Results <span className="repo-results-count">{totalElements} total</span>
                </p>
                {totalElements > 0 && (
                  <span className="repo-results-count">
                    {pageStart}–{pageEnd} of {totalElements} — PAGE {currentPage + 1}/{totalPages || 1}
                  </span>
                )}
              </div>

              <table className="se-table">
                <thead>
                  <tr>
                    <th className="se-th" style={{ width: 36 }}></th>
                    <th className="se-th">File</th>
                    <th className="se-th">Area</th>
                    <th className="se-th">Office</th>
                    <th className="se-th">Activity</th>
                    <th className="se-th">Uploaded</th>
                    <th className="se-th">Type</th>
                    <th className="se-th">Refs</th>
                    <th className="se-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td className="am-empty" colSpan={9}>Searching…</td></tr>
                  )}
                  {!loading && results.length === 0 && (
                    <tr><td className="am-empty" colSpan={9}>No results found.</td></tr>
                  )}
                  {!loading && results.map((item) => (
                    <tr key={item.id}>
                      <td className="se-td" style={{ textAlign: 'center' }}>
                        <input type="checkbox" />
                      </td>
                      <td className="se-td">
                        <div className="se-td-file">
                          <span className="se-file-icon">{item.fileType}</span>
                          <div>
                            <span className="se-file-name">{item.originalFileName}</span>
                            <div style={{ fontSize: '0.64rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                              {formatFileSize(item.fileSize)} · {item.uploadedByName || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="se-td">
                        <span className="am-type-badge">{formatAccreditationArea(item.accreditationArea)}</span>
                      </td>
                      <td className="se-td" style={{ fontSize: '0.72rem' }}>
                        {item.office || item.department || '-'}
                      </td>
                      <td className="se-td" style={{ fontSize: '0.72rem' }}>
                        {formatActivityType(item.activityType)}
                      </td>
                      <td className="se-td" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(item.uploadedAt)}
                      </td>
                      <td className="se-td">
                        <span className="se-file-icon">{item.fileType}</span>
                      </td>
                      <td className="se-td">
                        <span className="se-refs-count">{item.referenceCount}</span>
                      </td>
                      <td className="se-td">
                        <a
                          className="am-link-button"
                          href={`http://localhost:8080/api/evidence/${item.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                        <button
                          className="am-link-button"
                          type="button"
                          onClick={() => openReferenceFlow(item)}
                        >
                          Reference
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="repo-pagination">
                  <span className="repo-page-info">{pageStart}–{pageEnd} of {totalElements}</span>
                  <div className="repo-page-buttons">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0 || loading}>◀</button>
                    {getPageNumbers(currentPage, totalPages).map((p, i) =>
                      p === '...'
                        ? <span key={`d${i}`} className="repo-page-dots">…</span>
                        : (
                          <button
                            key={p}
                            className={p === currentPage ? 'repo-page-active' : ''}
                            onClick={() => handlePageChange(p)}
                            disabled={loading}
                          >
                            {p + 1}
                          </button>
                        )
                    )}
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1 || loading}>▶</button>
                  </div>
                </div>
              )}
          </>
        </div>
      </div>

      {referenceEvidence && (
        <div className="repo-reference-panel">
          <p className="am-section-label">Reference Evidence</p>
          <div className="repo-reference-row">
            <span className="repo-reference-file">{referenceEvidence.originalFileName}</span>
            <select
              className="am-select"
              value={targetActivityId}
              onChange={(e) => setTargetActivityId(e.target.value)}
            >
              <option value="">Select target activity</option>
              {activities
                .filter((activity) => activity.id !== referenceEvidence.activityId)
                .map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.activityName} - {activity.department || activity.office || 'No office'}
                  </option>
                ))}
            </select>
            <button
              className="am-btn-primary"
              type="button"
              disabled={!targetActivity}
              onClick={() => setReferenceModalOpen(true)}
            >
              Confirm
            </button>
            <button
              className="am-btn-secondary"
              type="button"
              onClick={() => setReferenceEvidence(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {referenceEvidence && targetActivity && (
        <ReferenceConfirmModal
          evidence={referenceEvidence}
          activity={targetActivity}
          isOpen={referenceModalOpen}
          onClose={() => setReferenceModalOpen(false)}
          onSuccess={handleReferenceSuccess}
        />
      )}
    </ActivityShell>
  );
}
