import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import Modal from '../../../shared/components/Modal';
import { listActivities } from '../api';
import {
  ACCREDITATION_AREAS,
  ACTIVITY_CREATE_ROLES,
  ACTIVITY_TYPES,
  DEPARTMENTS,
  EVIDENCE_TYPES,
  OFFICES,
  SERVICE_OFFICES,
  formatActivityType,
  formatDeptOrOffice,
} from '../constants';

const ORGANIZATION_UNITS = [
  ...DEPARTMENTS,
  ...OFFICES,
  ...SERVICE_OFFICES,
];

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ActivitiesListPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [accreditationAreaFilter, setAccreditationAreaFilter] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await listActivities();
      setActivities(data);
    } catch {
      setError('Failed to load activities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((activity) => {
      const name = activity.activityName || '';
      const academicYear = activity.academicYear || '';
      const department = activity.department || '';
      const office = activity.office || '';

      const matchesSearch = !q || name.toLowerCase().includes(q)
        || academicYear.toLowerCase().includes(q)
        || department.toLowerCase().includes(q)
        || office.toLowerCase().includes(q);
      const matchesType = !activityTypeFilter || activity.activityType === activityTypeFilter;
      const matchesOrganization = !organizationFilter
        || department === organizationFilter
        || office === organizationFilter;
      const matchesAcademicYear = !academicYearFilter || academicYear === academicYearFilter;
      const matchesAccreditationArea = !accreditationAreaFilter
        || activity.accreditationArea === accreditationAreaFilter;

      return matchesSearch
        && matchesType
        && matchesOrganization
        && matchesAcademicYear
        && matchesAccreditationArea;
    });
  }, [
    activities,
    query,
    activityTypeFilter,
    organizationFilter,
    academicYearFilter,
    accreditationAreaFilter,
  ]);

  const academicYears = useMemo(() => (
    [...new Set(activities.map((activity) => activity.academicYear).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a))
  ), [activities]);

  // Only offer org units that actually appear in the (already access-scoped)
  // activities the user can see - a dept staff member's list only ever
  // contains their own department, so the full institution-wide list would
  // mostly just be empty options for them.
  const organizationOptions = useMemo(() => {
    const seen = new Map();
    activities.forEach((activity) => {
      const value = activity.department || activity.office;
      if (!value || seen.has(value)) return;
      const known = ORGANIZATION_UNITS.find((unit) => unit.value === value);
      seen.set(value, known ? known.label : value);
    });
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activities]);

  const hasActiveFilters = query || activityTypeFilter || organizationFilter
    || academicYearFilter || accreditationAreaFilter;

  const clearFilters = () => {
    setQuery('');
    setActivityTypeFilter('');
    setOrganizationFilter('');
    setAcademicYearFilter('');
    setAccreditationAreaFilter('');
  };

  const canCreateActivity = user && ACTIVITY_CREATE_ROLES.includes(user.role);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Activities</h1>
        {canCreateActivity && (
          <div style={{ position: 'relative' }}>
            <button className="am-btn-primary" onClick={() => setShowDropdown(!showDropdown)}>
              + New ▾
            </button>
              <div className={`am-dropdown-menu ${showDropdown ? 'open' : ''}`}>
                <Link to="/activities/new" className="am-dropdown-item" onClick={() => setShowDropdown(false)}>Create Activity</Link>
                <button className="am-dropdown-item" style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setShowDropdown(false); setShowUploadModal(true); }}>Upload Document</button>
              </div>
          </div>
        )}
      </div>

      <div className="am-filters">
        <input
          className="am-search"
          placeholder="Search activities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="am-select" value={activityTypeFilter} onChange={(e) => setActivityTypeFilter(e.target.value)}>
          <option value=""> All types   </option>
          {ACTIVITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <select className="am-select" value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)}>
          <option value=""> All departments/offices </option>
          {organizationOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
        </select>
        <select className="am-select" value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)}>
          <option value=""> All academic years </option>
          {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select className="am-select" value={accreditationAreaFilter} onChange={(e) => setAccreditationAreaFilter(e.target.value)}>
          <option value=""> All areas </option>
          {ACCREDITATION_AREAS.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}
        </select>
        {hasActiveFilters && (
          <button className="am-btn-secondary am-clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      <div className="am-table-section">
        <div className="am-table-header-row">
          <span className="am-section-label">
            Activity Records <span className="am-count">{filteredActivities.length} total</span>
          </span>
        </div>
        <table className="am-table">
          <thead>
            <tr>
              <th className="am-th">Title</th>
              <th className="am-th">Type</th>
              <th className="am-th">Department / Office</th>
              <th className="am-th">Academic Year</th>
              <th className="am-th">Date</th>
              <th className="am-th am-th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivities.map((activity) => (
              <tr key={activity.id}>
                <td className="am-td am-td-title">{activity.activityName}</td>
                <td className="am-td"><span className="am-type-badge">{formatActivityType(activity.activityType, activity.customActivityType)}</span></td>
                <td className="am-td">{formatDeptOrOffice(activity.department, activity.office)}</td>
                <td className="am-td">{activity.academicYear}</td>
                <td className="am-td">{formatDate(activity.activityDate)}</td>
                <td className="am-td am-td-action">
                  <Link className="am-link-button" to={`/activities/${activity.id}`}>View Details</Link>
                </td>
              </tr>
            ))}
            {!loading && filteredActivities.length === 0 && (
              <tr><td className="am-empty" colSpan={6}>No activities found</td></tr>
            )}
            {loading && (
              <tr><td className="am-empty" colSpan={6}>Loading activities...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Document">
        <div className="am-upload-dropzone">
          <svg style={{ width: '32px', height: '32px', color: '#9ca3af', marginBottom: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          <p>Drag and drop your file here, or click to browse</p>
        </div>
        
        <div className="am-form-field" style={{ marginBottom: '1rem' }}>
          <label className="am-form-label">Target Activity <span className="am-required">*</span></label>
          <select className="am-select">
            <option value="">Select an activity...</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.activityName}</option>)}
          </select>
        </div>

        <div className="am-form-field" style={{ marginBottom: '1rem' }}>
          <label className="am-form-label">Evidence Type <span className="am-required">*</span></label>
          <select className="am-select">
            <option value="">Select type...</option>
            {EVIDENCE_TYPES?.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="am-form-field">
          <label className="am-form-label">Tags</label>
          <input className="am-input" placeholder="e.g. research, attendance (comma separated)" />
        </div>

        <div className="am-upload-modal-actions">
          <button className="am-btn-secondary" onClick={() => setShowUploadModal(false)}>Cancel</button>
          <button className="am-btn-primary" disabled>Upload & Save</button>
        </div>
      </Modal>
    </ActivityShell>
  );
}
