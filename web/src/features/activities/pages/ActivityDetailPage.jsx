import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ROLE_LABELS } from '../../../shared/constants/roles';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import { deleteActivity, getActivity } from '../api';
import { ACTIVITY_WRITE_ROLES, formatAccreditationArea, formatActivityType, formatDepartment, formatOffice } from '../constants';
import EvidencePanel from '../../evidence/components/EvidencePanel';
import BatchMetadataPanel from '../../evidence/components/BatchMetadataPanel';
import ReferencedEvidencePanel from '../../evidence/components/ReferencedEvidencePanel';
import GenerateAccreditorAccessModal from '../../accreditor-access/components/GenerateAccreditorAccessModal';

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function hasMetadata(item) {
  return Boolean(item.evidenceType || item.relatedOffices?.length || item.tags?.length || item.notes);
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
  const [accreditorAccessOpen, setAccreditorAccessOpen] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [evidenceRefreshKey, setEvidenceRefreshKey] = useState(0);

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
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);

  const handleEvidenceChange = useCallback((items) => {
    setEvidenceItems(items);
    setBatchSelectedIds((current) => current.filter((idValue) => {
      const item = items.find((candidate) => candidate.id === idValue);
      return item && !hasMetadata(item);
    }));
  }, []);

  const handleToggleBatchSelection = useCallback((item) => {
    if (!item || hasMetadata(item)) return;
    setBatchSelectedIds((current) => (
      current.includes(item.id)
        ? current.filter((idValue) => idValue !== item.id)
        : [...current, item.id]
    ));
  }, []);

  const handleSelectAllBatchEligible = useCallback((items) => {
    setBatchSelectedIds((current) => {
      const eligibleIds = items.filter((item) => !hasMetadata(item)).map((item) => item.id);
      const allSelected = eligibleIds.length > 0 && eligibleIds.every((idValue) => current.includes(idValue));
      return allSelected ? [] : eligibleIds;
    });
  }, []);

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
              <Link className="am-btn-secondary" to={`/activities/${activity.id}/evidence`}>Upload Evidence</Link>
              <button className="am-btn-secondary" type="button" onClick={() => setAccreditorAccessOpen(true)}>
                Generate Accreditor Access
              </button>
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
              <span className="am-type-badge">{formatActivityType(activity.activityType, activity.customActivityType)}</span>
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
                <dd>{activity.department ? formatDepartment(activity.department) : '-'}</dd>
              </div>
              <div>
                <dt>Office</dt>
                <dd>{activity.office ? formatOffice(activity.office) : '-'}</dd>
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
            <EvidencePanel
              key={evidenceRefreshKey}
              activityId={activity.id}
              batchSelectionEnabled={canManageActivity}
              batchSelectedIds={batchSelectedIds}
              canManageEvidence={canManageActivity}
              onEvidenceChange={handleEvidenceChange}
              onSelectAllBatchEligible={handleSelectAllBatchEligible}
              onToggleBatchSelection={handleToggleBatchSelection}
            />
          </div>

          {canManageActivity && (
            <div className="am-evidence-section">
              <BatchMetadataPanel
                activityId={activity.id}
                evidence={evidenceItems}
                hideEvidenceSelection
                selectedIds={batchSelectedIds}
                onSelectedIdsChange={setBatchSelectedIds}
                onSaved={() => setEvidenceRefreshKey((current) => current + 1)}
              />
            </div>
          )}

          <div className="am-evidence-section">
            <ReferencedEvidencePanel activityId={activity.id} canManageReferences={canManageActivity} />
          </div>

          <GenerateAccreditorAccessModal
            isOpen={accreditorAccessOpen}
            onClose={() => setAccreditorAccessOpen(false)}
            activityId={activity.id}
            title="Generate Activity Evidence Access"
          />
        </div>
      )}
    </ActivityShell>
  );
}
