import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import ActivityWorkflowSidebar from '../components/ActivityWorkflowSidebar';
import { getActivity } from '../api';
import {
  ACTIVITY_WRITE_ROLES,
  formatAccreditationArea,
  formatActivityType,
  formatDepartment,
  formatOffice,
} from '../constants';
import EvidencePanel from '../../evidence/components/EvidencePanel';

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

export default function UploadEvidencePage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [activity, setActivity] = useState(null);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  const canManageEvidence = user && ACTIVITY_WRITE_ROLES.includes(user.role);
  const hasUploadedEvidence = evidenceCount > 0;
  const canProceedToMetadata = hasUploadedEvidence && !uploadInProgress;
  const handleEvidenceChange = useCallback((items) => {
    setEvidenceCount(items.length);
  }, []);
  const handleUploadStateChange = useCallback((uploading) => {
    setUploadInProgress(uploading);
  }, []);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Upload Evidence</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Upload Evidence</h1>
        <div className="am-page-actions">
          {uploadInProgress ? (
            <button className="am-btn-secondary" type="button" disabled>Back</button>
          ) : (
            <Link className="am-btn-secondary" to={`/activities/${id}`}>Back</Link>
          )}
          {canProceedToMetadata ? (
            <Link className="am-btn-primary" to={`/activities/${id}/metadata`}>Assign Metadata</Link>
          ) : (
            <button className="am-btn-primary" type="button" disabled>Assign Metadata</button>
          )}
        </div>
      </div>

      {location.state?.message && <p className="am-alert am-alert-success">{location.state.message}</p>}
      {error && <p className="am-alert am-alert-error">{error}</p>}
      {loading && <p className="am-empty am-empty-plain">Loading activity...</p>}

      {activity && (
        <div className="am-workflow-layout">
          <div className="am-workflow-main">
            <ActivitySummary activity={activity} />
            <EvidencePanel
              activityId={activity.id}
              canManageEvidence={canManageEvidence}
              lockManagementActions
              onEvidenceChange={handleEvidenceChange}
              onUploadStateChange={handleUploadStateChange}
              title="Upload Evidence"
            />
            <div className="am-form-actions am-workflow-actions">
              {uploadInProgress ? (
                <button className="am-btn-secondary" type="button" disabled>Back</button>
              ) : (
                <Link className="am-btn-secondary" to="/activities/new">Back</Link>
              )}
              {canProceedToMetadata ? (
                <Link className="am-btn-primary" to={`/activities/${activity.id}/metadata`}>Next Step</Link>
              ) : (
                <button className="am-btn-primary" type="button" disabled>Next Step</button>
              )}
            </div>
          </div>

          <ActivityWorkflowSidebar
            activeStep="upload"
            activityId={activity.id}
            disabledSteps={[
              ...(!canProceedToMetadata ? ['metadata'] : []),
              ...(uploadInProgress ? ['create'] : []),
            ]}
          />
        </div>
      )}
    </ActivityShell>
  );
}
