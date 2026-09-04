import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ActivityShell from '../components/ActivityShell';
import ActivityWorkflowSidebar from '../components/ActivityWorkflowSidebar';
import { getActivity } from '../api';
import {
  formatAccreditationArea,
  formatActivityType,
  formatDepartment,
  formatOffice,
} from '../constants';
import BatchMetadataPanel from '../../evidence/components/BatchMetadataPanel';

function ActivitySummary({ activity }) {
  return (
    <section className="am-panel am-summary-panel">
      <p className="am-section-label">Activity Summary</p>
      <dl className="am-summary-list">
        <div><dt>Activity Name</dt><dd>{activity.activityName}</dd></div>
        <div><dt>Office</dt><dd>{activity.office ? formatOffice(activity.office) : '-'}</dd></div>
        <div><dt>Department</dt><dd>{activity.department ? formatDepartment(activity.department) : '-'}</dd></div>
        <div><dt>Activity Type</dt><dd>{formatActivityType(activity.activityType, activity.customActivityType)}</dd></div>
        <div><dt>Academic Year</dt><dd>{activity.academicYear}</dd></div>
        <div><dt>Accreditation Area</dt><dd>{formatAccreditationArea(activity.accreditationArea)}</dd></div>
      </dl>
    </section>
  );
}

export default function AssignMetadataPage() {
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getActivity(id);
      setActivity(data);
    } catch {
      setError('Activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Assign Metadata</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Assign Metadata</h1>
        <div className="am-page-actions">
          <Link className="am-btn-secondary" to={`/activities/${id}/evidence`}>Back</Link>
          <Link className="am-btn-secondary" to={`/activities/${id}`}>Activity Details</Link>
        </div>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}
      {loading && <p className="am-empty am-empty-plain">Loading metadata workspace...</p>}

      {activity && !loading && (
        <div className="am-workflow-layout">
          <div className="am-workflow-main">
            <ActivitySummary activity={activity} />
            <BatchMetadataPanel activityId={activity.id} />
            <div className="am-form-actions am-workflow-actions">
              <Link className="am-btn-secondary" to={`/activities/${activity.id}/evidence`}>Back</Link>
            </div>
          </div>

          <ActivityWorkflowSidebar
            activeStep="metadata"
            activityId={activity.id}
          />
        </div>
      )}
    </ActivityShell>
  );
}
