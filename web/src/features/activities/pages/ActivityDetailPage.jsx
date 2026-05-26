import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ROLE_LABELS } from '../../../shared/constants/roles';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import { deleteActivity, getActivity } from '../api';
import { ACTIVITY_WRITE_ROLES, formatAccreditationArea, formatActivityType } from '../constants';
import EvidencePanel from '../../evidence/components/EvidencePanel';

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ActivityDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getActivity(id);
      setActivity(data);
    } catch {
      setError('Activity not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const canManageActivity = user && ACTIVITY_WRITE_ROLES.includes(user.role);

  const handleDelete = async () => {
    if (!activity || !window.confirm(`Delete ${activity.activityName}?`)) return;

    setIsDeleting(true);
    setError('');
    try {
      await deleteActivity(activity.id);
      navigate('/activities', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete activity.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Details</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Activity Details</h1>
        <div className="am-page-actions">
          {activity && (
            <Link className="am-btn-secondary" to={`/activities/${activity.id}/reference-evidence`}>
              Reference Evidence
            </Link>
          )}
          {activity && canManageActivity && (
            <>
              <Link className="am-btn-secondary" to={`/activities/${activity.id}/edit`}>Edit Activity</Link>
              <button className="am-btn-danger" type="button" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Activity'}
              </button>
            </>
          )}
          <Link className="am-btn-secondary" to="/activities">Back to List</Link>
        </div>
      </div>

      {location.state?.message && <p className="am-alert am-alert-success">{location.state.message}</p>}
      {error && <p className="am-alert am-alert-error">{error}</p>}
      {loading && <p className="am-empty am-empty-plain">Loading activity...</p>}

      {activity && (
        <div className="am-detail-stack">
          <section className="am-panel am-panel-main">
            <div className="am-detail-heading">
              <div>
                <p className="am-section-label">Activity Record</p>
                <h2 className="am-detail-title">{activity.activityName}</h2>
              </div>
              <span className="am-type-badge">{formatActivityType(activity.activityType)}</span>
            </div>

            <dl className="am-detail-list">
              <div>
                <dt>Activity Date</dt>
                <dd>{formatDate(activity.activityDate)}</dd>
              </div>
              <div>
                <dt>Accreditation Area</dt>
                <dd>{formatAccreditationArea(activity.accreditationArea)}</dd>
              </div>
              <div>
                <dt>Academic Year</dt>
                <dd>{activity.academicYear}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{activity.department || '-'}</dd>
              </div>
              <div>
                <dt>Office</dt>
                <dd>{activity.office || '-'}</dd>
              </div>
              <div>
                <dt>Created By</dt>
                <dd>{activity.createdByName || '-'}</dd>
              </div>
              <div>
                <dt>Creator Role</dt>
                <dd>{ROLE_LABELS[activity.createdByRole] || activity.createdByRole || '-'}</dd>
              </div>
            </dl>

            <div className="am-description">
              <p className="am-section-label">Description</p>
              <p>{activity.description || 'No description provided.'}</p>
            </div>
          </section>

          <div className="am-evidence-section">
            <EvidencePanel activityId={activity.id} canManageEvidence={canManageActivity} />
          </div>
        </div>
      )}
    </ActivityShell>
  );
}
