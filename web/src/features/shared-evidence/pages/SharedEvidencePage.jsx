import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import { searchSharedEvidence } from '../api';
import { ACCREDITATION_AREAS, formatAccreditationArea, formatDepartment, formatOffice } from '../../activities/constants';
import { useAuth } from '../../../shared/hooks/useAuth';
import GenerateAccreditorAccessModal from '../../accreditor-access/components/GenerateAccreditorAccessModal';
import '../SharedEvidence.css';

function ownerOffice(item) {
  if (item.office) return formatOffice(item.office);
  if (item.department) return formatDepartment(item.department);
  return '-';
}

export default function SharedEvidencePage() {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [area, setArea] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [accessEvidenceId, setAccessEvidenceId] = useState('');

  const runSearch = useCallback(async (page = 0) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: 10 };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (area) params.area = area;
      if (academicYear.trim()) params.academicYear = academicYear.trim();

      const { data } = await searchSharedEvidence(params);
      setResults(data.content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setCurrentPage(data.number);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load shared evidence.');
    } finally {
      setLoading(false);
    }
  }, [keyword, area, academicYear]);

  useEffect(() => {
    runSearch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(0);
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Shared Evidence</p>
      <div className="am-page-header">
        <div>
          <h1 className="am-page-title">Shared Evidence</h1>
          <p className="se-page-context">
            Office-owned evidence reused by other activities.
            {user?.department ? ` Showing ${user.department} evidence only.` : ''}
          </p>
        </div>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      <div className="se-layout">
        <form className="se-filter-panel" onSubmit={handleSearch}>
          <div className="se-filter-group">
            <span className="se-filter-label">Owner Office</span>
            <div className="se-scope-box">{user?.department || 'No office assigned'}</div>
          </div>

          <div className="se-filter-group">
            <span className="se-filter-label">Keyword</span>
            <input
              className="am-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="File or source activity"
            />
          </div>

          <div className="se-filter-group">
            <span className="se-filter-label">Area</span>
            <select className="am-select" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {ACCREDITATION_AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <div className="se-filter-group">
            <span className="se-filter-label">Academic Year</span>
            <input
              className="am-input"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2025-2026"
            />
          </div>

          <button className="am-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="se-results-panel">
          <div className="se-results-header">
            <p className="am-section-label">
              Office Evidence Reuse <span className="se-results-count">{totalElements} total</span>
            </p>
          </div>

          <table className="se-table">
            <thead>
              <tr>
                <th className="se-th">File Name</th>
                <th className="se-th">Source Activity</th>
                <th className="se-th">Owner Office</th>
                <th className="se-th">Accreditation Area</th>
                <th className="se-th">Reference Count</th>
                <th className="se-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="am-empty" colSpan={6}>Loading shared evidence...</td></tr>
              )}
              {!loading && results.length === 0 && (
                <tr>
                  <td className="am-empty" colSpan={6}>
                    No evidence from this office has been referenced yet.
                  </td>
                </tr>
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
                  <td className="se-td">{ownerOffice(item)}</td>
                  <td className="se-td">
                    <span className="am-type-badge">{formatAccreditationArea(item.accreditationArea)}</span>
                  </td>
                  <td className="se-td">
                    <span className="se-refs-count">{item.referenceCount}</span>
                  </td>
                  <td className="se-td">
                    <Link className="am-link-button" to={`/shared-evidence/${item.id}/references`}>
                      View Details
                    </Link>
                    <button className="am-link-button" type="button" onClick={() => setAccessEvidenceId(item.id)}>
                      Generate Access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="se-pagination">
              <button
                className="am-btn-secondary"
                type="button"
                onClick={() => runSearch(currentPage - 1)}
                disabled={currentPage === 0 || loading}
              >
                Prev
              </button>
              <span>{currentPage + 1} / {totalPages}</span>
              <button
                className="am-btn-secondary"
                type="button"
                onClick={() => runSearch(currentPage + 1)}
                disabled={currentPage >= totalPages - 1 || loading}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <GenerateAccreditorAccessModal
        isOpen={Boolean(accessEvidenceId)}
        onClose={() => setAccessEvidenceId('')}
        evidenceIds={accessEvidenceId ? [accessEvidenceId] : []}
      />
    </ActivityShell>
  );
}
