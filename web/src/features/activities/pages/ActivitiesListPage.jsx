import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import Modal from '../../../shared/components/Modal';
import { listActivities } from '../api';
import { ACTIVITY_WRITE_ROLES, formatActivityType, formatDeptOrOffice, EVIDENCE_TYPES } from '../constants';

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
    if (!q) return activities;
    return activities.filter((activity) => {
      const name = activity.activityName || '';
      const academicYear = activity.academicYear || '';
      const department = activity.department || '';
      const office = activity.office || '';

      return name.toLowerCase().includes(q)
        || academicYear.toLowerCase().includes(q)
        || department.toLowerCase().includes(q)
        || office.toLowerCase().includes(q);
    });
  }, [activities, query]);

  const canManageActivity = user && ACTIVITY_WRITE_ROLES.includes(user.role);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Activities</h1>
        {canManageActivity && (
          <div style={{ position: 'relative' }}>
            <button className="am-btn-primary" onClick={() => setShowDropdown(!showDropdown)}>
              Documentation Type ▾
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
