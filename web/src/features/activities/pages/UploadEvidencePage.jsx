import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import ActivityWorkflowSidebar from '../components/ActivityWorkflowSidebar';
import { getActivity } from '../api';
import {
  ACTIVITY_CREATE_ROLES,
  formatAccreditationArea,
  formatActivityType,
  formatDepartment,
} from '../constants';
import EvidencePanel from '../../evidence/components/EvidencePanel';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Icon from '../../../shared/components/Icon';
import Alert from '../../../shared/components/Alert';

function ActivitySummary({ activity }) {
  return (
    <section className="am-panel am-summary-panel">
      <p className="am-section-label">Activity Summary</p>
      <dl className="am-summary-list">
        <div><dt>Activity Name</dt><dd>{activity.activityName}</dd></div>
        <div><dt>Department/Office Owner</dt><dd>{formatDepartment(activity.office || activity.department)}</dd></div>
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
  const [selectedIds, setSelectedIds] = useState([]);
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

  const canManageEvidence = user && ACTIVITY_CREATE_ROLES.includes(user.role);
  const hasUploadedEvidence = evidenceCount > 0;
  const canProceedToMetadata = hasUploadedEvidence && !uploadInProgress;
  const handleEvidenceChange = useCallback((items) => {
    setEvidenceCount(items.length);
    // Forget selected files that no longer exist (e.g. deleted).
    setSelectedIds((current) => {
      const next = current.filter((idValue) => items.some((item) => item.id === idValue));
      return next.length === current.length ? current : next;
    });
  }, []);
  const handleToggleSelection = useCallback((item) => {
    setSelectedIds((current) => (
      current.includes(item.id) ? current.filter((idValue) => idValue !== item.id) : [...current, item.id]
    ));
  }, []);
  // Selects every uploaded file, or clears the selection when they are all selected already.
  const handleSelectAll = useCallback((items) => {
    const allIds = items.map((item) => item.id);
    setSelectedIds((current) => (
      allIds.length > 0 && allIds.every((idValue) => current.includes(idValue)) ? [] : allIds
    ));
  }, []);
  // The chosen files are preselected on the Assign Metadata page.
  const metadataLinkState = selectedIds.length > 0 ? { selectedIds } : undefined;
  const handleUploadStateChange = useCallback((uploading) => {
    setUploadInProgress(uploading);
  }, []);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Upload Evidence</p>
      <div className="am-page-header">
        <div className="am-page-header-left">
          {uploadInProgress ? (
            <button className="am-btn-secondary" type="button" disabled><Icon as={ArrowLeft} /> Back</button>
          ) : (
            <Link className="am-btn-secondary" to={`/activities/${id}`}><Icon as={ArrowLeft} /> Back</Link>
          )}
          <h1 className="am-page-title">Upload Evidence</h1>
        </div>
        <div className="am-page-actions">
          {canProceedToMetadata ? (
            <Link className="am-btn-primary" to={`/activities/${id}/metadata`} state={metadataLinkState}>Assign Metadata</Link>
          ) : (
            <button className="am-btn-primary" type="button" disabled>Assign Metadata</button>
          )}
        </div>
      </div>

      {location.state?.message && <p className="am-alert am-alert-success">{location.state.message}</p>}
      <Alert type="error" message={error} onDismiss={() => setError('')} />
      {loading && <p className="am-empty am-empty-plain">Loading activity...</p>}

      {activity && (
        <div className="am-workflow-layout">
          <div className="am-workflow-main">
            <ActivitySummary activity={activity} />
            <EvidencePanel
              activityId={activity.id}
              canManageEvidence={canManageEvidence}
              lockManagementActions
              batchSelectionEnabled={canManageEvidence}
              batchSelectedIds={selectedIds}
              onSelectAllBatchEligible={handleSelectAll}
              onToggleBatchSelection={handleToggleSelection}
              onEvidenceChange={handleEvidenceChange}
              onUploadStateChange={handleUploadStateChange}
              title="Upload Evidence"
            />
            <div className="am-form-actions am-workflow-actions-split">
              {uploadInProgress ? (
                <button className="am-btn-secondary" type="button" disabled><Icon as={ArrowLeft} /> Back</button>
              ) : (
                <Link className="am-btn-secondary" to="/activities/new"><Icon as={ArrowLeft} /> Back</Link>
              )}
              {canProceedToMetadata ? (
                <Link className="am-btn-primary" to={`/activities/${activity.id}/metadata`} state={metadataLinkState}>Next Step <Icon as={ArrowRight} /></Link>
              ) : (
                <button className="am-btn-primary" type="button" disabled>Next Step <Icon as={ArrowRight} /></button>
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
