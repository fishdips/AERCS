import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import { searchSharedEvidence } from '../api';
import { ACCREDITATION_AREAS, DEPARTMENTS, formatAccreditationArea } from '../../activities/constants';
import '../SharedEvidence.css';

const FILE_TYPES = ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SharedEvidencePage() {
  const [results, setResults] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [area, setArea] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [activeFileTypes, setActiveFileTypes] = useState([]);

  const [preview, setPreview] = useState(null);

  const runSearch = useCallback(async (page = 0) => {
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const params = { page, size: 10 };
      if (keyword) params.keyword = keyword;
      if (area) params.area = area;
      if (department) params.department = department;
      if (academicYear) params.academicYear = academicYear;

      const { data } = await searchSharedEvidence(params);
      let content = data.content;
      if (activeFileTypes.length > 0) {
        content = content.filter((e) => activeFileTypes.includes(e.fileType));
      }
      setResults(content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
      setCurrentPage(data.number);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load evidence.');
    } finally {
      setLoading(false);
    }
  }, [keyword, area, department, academicYear, activeFileTypes]);

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(0);
  };

  const toggleFileType = (ft) => {
    setActiveFileTypes((prev) =>
      prev.includes(ft) ? prev.filter((t) => t !== ft) : [...prev, ft]
    );
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Shared Evidence</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Shared Evidence</h1>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      <div className="se-layout">
        {/* Left: filters */}
        <form className="se-filter-panel" onSubmit={handleSearch}>
          <div className="se-filter-group">
            <span className="se-filter-label">Keyword</span>
            <input
              className="am-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="File name, activity, tags…"
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
            <span className="se-filter-label">Office / Department</span>
            <select className="am-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
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

          <div className="se-filter-group">
            <span className="se-filter-label">File Type</span>
            <div className="se-file-type-row">
              {FILE_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  className={`se-file-type-btn ${activeFileTypes.includes(ft) ? 'active' : ''}`}
                  onClick={() => toggleFileType(ft)}
                >
                  {ft}
                </button>
              ))}
            </div>
          </div>

          <button className="am-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Right: results */}
        <div className="se-results-panel">
          {!searched && (
            <div className="am-evidence-placeholder" style={{ minHeight: 200 }}>
              <span>Use the filters to search the evidence repository.</span>
            </div>
          )}

          {searched && (
            <>
              <div className="se-results-header">
                <p className="am-section-label">
                  Repository Results{' '}
                  <span className="se-results-count">{totalElements} total</span>
                </p>
              </div>

              <table className="se-table">
                <thead>
                  <tr>
                    <th className="se-th">File</th>
                    <th className="se-th">Office</th>
                    <th className="se-th">Area</th>
                    <th className="se-th">AY</th>
                    <th className="se-th">Uploaded</th>
                    <th className="se-th">Refs</th>
                    <th className="se-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td className="am-empty" colSpan={7}>Searching…</td></tr>
                  )}
                  {!loading && results.length === 0 && (
                    <tr>
                      <td className="am-empty" colSpan={7}>No results found.</td>
                    </tr>
                  )}
                  {results.map((item) => (
                    <tr
                      key={item.id}
                      style={{ cursor: 'pointer', background: preview?.id === item.id ? '#f9fafb' : undefined }}
                      onClick={() => setPreview(item)}
                    >
                      <td className="se-td">
                        <div className="se-td-file">
                          <span className="se-file-icon">{item.fileType}</span>
                          <span className="se-file-name">{item.originalFileName}</span>
                        </div>
                      </td>
                      <td className="se-td">{item.uploadedByDepartment || item.department || item.office || '-'}</td>
                      <td className="se-td">
                        <span className="am-type-badge">{formatAccreditationArea(item.accreditationArea)}</span>
                      </td>
                      <td className="se-td">{item.academicYear || '-'}</td>
                      <td className="se-td">{formatDate(item.uploadedAt)}</td>
                      <td className="se-td">
                        <span className="se-refs-count">{item.referenceCount}</span>
                      </td>
                      <td className="se-td">
                        <Link
                          className="am-link-button"
                          to={`/shared-evidence/${item.id}/references`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Refs
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button
                    className="am-btn-secondary"
                    type="button"
                    onClick={() => runSearch(currentPage - 1)}
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
                    onClick={() => runSearch(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || loading}
                  >
                    Next
                  </button>
                </div>
              )}

              {preview && (
                <div className="se-preview-row">
                  <div>
                    <p className="am-section-label" style={{ marginBottom: '0.5rem' }}>Preview</p>
                    <div className="se-preview-box">[ {preview.fileType} PREVIEW ]</div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.4rem' }}>
                      {preview.originalFileName} · {formatFileSize(preview.fileSize)}
                    </div>
                    <div className="se-preview-actions">
                      <a
                        className="am-btn-secondary"
                        href={`http://localhost:8080/api/evidence/${preview.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Preview
                      </a>
                      <a
                        className="am-btn-secondary"
                        href={`http://localhost:8080/api/evidence/${preview.id}/download`}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="am-section-label" style={{ marginBottom: '0.5rem' }}>Metadata</p>
                    <div className="se-meta-list">
                      <div className="se-meta-row">
                        <span className="se-meta-key">Evidence</span>
                        <span className="se-meta-val">{preview.evidenceType ?? '-'}</span>
                      </div>
                      <div className="se-meta-row">
                        <span className="se-meta-key">Area</span>
                        <span className="se-meta-val">{formatAccreditationArea(preview.accreditationArea)}</span>
                      </div>
                      <div className="se-meta-row">
                        <span className="se-meta-key">AY</span>
                        <span className="se-meta-val">{preview.academicYear || '-'}</span>
                      </div>
                      <div className="se-meta-row">
                        <span className="se-meta-key">Refs</span>
                        <span className="se-meta-val">{preview.referenceCount} activities</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.85rem' }}>
                      <Link className="am-btn-secondary" to={`/shared-evidence/${preview.id}/references`}>
                        View All References →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ActivityShell>
  );
}
