import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ROLE_LABELS, ROLES } from '../../../shared/constants/roles';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import { deleteActivity, getActivity, updateActivity } from '../api';
import {
  ACCREDITATION_AREAS,
  ACTIVITY_CREATE_ROLES,
  ACTIVITY_WRITE_ROLES,
  formatAccreditationArea,
  formatActivityType,
  formatUserOffice,
} from '../constants';
import EvidencePanel from '../../evidence/components/EvidencePanel';
import BatchMetadataPanel from '../../evidence/components/BatchMetadataPanel';
import ReferencedEvidencePanel from '../../evidence/components/ReferencedEvidencePanel';
import GenerateAccreditorAccessModal from '../../accreditor-access/components/GenerateAccreditorAccessModal';
import ActionMenu from '../../../shared/components/ActionMenu';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { ArrowLeft, Check, KeyRound, Link2, Pencil, Trash2, Upload, X } from 'lucide-react';
import Icon from '../../../shared/components/Icon';

function formatDate(value) {
  if (!value) return '-';
  const str = String(value);
  const normalized = str.includes('T') ? str : `${str}T00:00:00`;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  const dateStr = d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateStr} · ${timeStr}`;
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [evidenceRefreshKey, setEvidenceRefreshKey] = useState(0);

  // In-place edit state for the Activity Record
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAccreditationArea, setEditAccreditationArea] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [editSubmitError, setEditSubmitError] = useState('');
  const [editSuccessNotice, setEditSuccessNotice] = useState('');

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
  const canCreateEvidence = user && ACTIVITY_CREATE_ROLES.includes(user.role);

  const isCreator = Boolean(
    user && activity && (
      (activity.createdById && user.id && String(activity.createdById).toLowerCase() === String(user.id).toLowerCase()) ||
      (activity.createdByName && user.name && activity.createdByName.trim().toLowerCase() === user.name.trim().toLowerCase())
    )
  );

  const isSameDeptOrOffice = Boolean(
    user && activity && (
      (user.department && activity.department && String(user.department).toUpperCase() === String(activity.department).toUpperCase()) ||
      (user.office && activity.office && String(user.office).toUpperCase() === String(activity.office).toUpperCase())
    )
  );

  const canEditRecord = Boolean(
    isCreator ||
    user?.role === ROLES.ADMIN ||
    (user?.role === ROLES.ACCRED_COORDINATOR && isSameDeptOrOffice)
  );

  const [batchSelectedIds, setBatchSelectedIds] = useState([]);

  const handleEvidenceChange = useCallback((items) => {
    setEvidenceItems(items);
    setBatchSelectedIds((current) => {
      const validCurrent = current.filter((idValue) => items.some((item) => item.id === idValue));
      if (validCurrent.length > 0) return validCurrent;
      return items.filter((item) => !hasMetadata(item)).map((item) => item.id);
    });
  }, []);

  const handleToggleBatchSelection = useCallback((item) => {
    if (!item) return;
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

  const handleStartEdit = useCallback(() => {
    if (!activity) return;
    setEditTitle(activity.activityName || '');
    setEditDescription(activity.description || '');
    setEditAccreditationArea(activity.accreditationArea || '');
    setEditErrors({});
    setEditSubmitError('');
    setIsEditing(true);
  }, [activity]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditErrors({});
    setEditSubmitError('');
  }, []);

  const handleSaveEdit = async () => {
    if (!activity) return;
    const nextErrors = {};
    if (!editTitle.trim()) nextErrors.title = 'Activity title is required';
    if (!editAccreditationArea) nextErrors.area = 'Accreditation area is required';
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    setEditSubmitError('');
    try {
      const payload = {
        activityName: editTitle.trim(),
        description: editDescription.trim(),
        activityType: activity.activityType,
        customActivityType: activity.customActivityType || null,
        activityDate: activity.activityDate,
        department: activity.department || null,
        office: activity.office || null,
        accreditationArea: editAccreditationArea,
        academicYear: activity.academicYear,
      };
      const { data } = await updateActivity(activity.id, payload);
      setActivity(data);
      setIsEditing(false);
      setEditSuccessNotice('Activity record updated successfully.');
      setTimeout(() => setEditSuccessNotice(''), 4000);
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) {
        setEditErrors({
          title: details.activityName || '',
          area: details.accreditationArea || '',
        });
      }
      setEditSubmitError(err.response?.data?.error || 'Failed to update activity. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;

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
        <div className="am-page-header-left">
          <Link className="am-btn-secondary" to="/activities"><Icon as={ArrowLeft} /> Back</Link>
          <h1 className="am-page-title">Activity Details</h1>
        </div>
        <div className="am-page-actions">
          {activity && (
            <Link className="am-btn-secondary" to={`/activities/${activity.id}/reference-evidence`}>
              <Icon as={Link2} /> Reference Evidence
            </Link>
          )}
          {activity && canManageActivity && (
            <ActionMenu
              items={[
                ...(canCreateEvidence
                  ? [{ icon: Upload, label: 'Upload Evidence', to: `/activities/${activity.id}/evidence` }]
                  : []),
                {
                  icon: KeyRound,
                  label: 'Generate Accreditor Access',
                  onClick: () => setAccreditorAccessOpen(true),
                },
                ...(canEditRecord
                  ? [{ icon: Pencil, label: 'Edit Activity', onClick: handleStartEdit }]
                  : []),
                {
                  icon: Trash2,
                  label: isDeleting ? 'Deleting...' : 'Delete Activity',
                  danger: true,
                  disabled: isDeleting,
                  onClick: () => setDeleteConfirmOpen(true),
                },
              ]}
            />
          )}
        </div>
      </div>

      {location.state?.message && <p className="am-alert am-alert-success">{location.state.message}</p>}
      {editSuccessNotice && <p className="am-alert am-alert-success">{editSuccessNotice}</p>}
      {error && <p className="am-alert am-alert-error">{error}</p>}
      {loading && <p className="am-empty am-empty-plain">Loading activity...</p>}

      {activity && (
        <div className="am-detail-stack">
          <section className="am-panel am-panel-main">
            <div className="am-detail-heading">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="am-section-label">Activity Record</p>
                {!isEditing ? (
                  <h2 className="am-detail-title">{activity.activityName}</h2>
                ) : (
                  <div style={{ marginTop: '0.35rem' }}>
                    <label className="am-section-label" htmlFor="edit-activity-title" style={{ fontSize: '0.62rem' }}>
                      Activity Title <span className="am-required">*</span>
                    </label>
                    <input
                      id="edit-activity-title"
                      type="text"
                      className="am-input"
                      value={editTitle}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        if (editErrors.title) setEditErrors((prev) => ({ ...prev, title: '' }));
                      }}
                      placeholder="Activity Title"
                      maxLength={150}
                    />
                    {editErrors.title && <span className="am-field-error">{editErrors.title}</span>}
                  </div>
                )}
              </div>
              <span className="am-type-badge">{formatActivityType(activity.activityType, activity.customActivityType)}</span>
            </div>

            <dl className="am-detail-list">
              <div>
                <dt>Activity Date</dt>
                <dd>{formatDate(activity.activityDate)}</dd>
              </div>
              <div>
                <dt>Accreditation Area {isEditing && <span className="am-required">*</span>}</dt>
                <dd>
                  {!isEditing ? (
                    formatAccreditationArea(activity.accreditationArea)
                  ) : (
                    <>
                      <select
                        className="am-select"
                        value={editAccreditationArea}
                        onChange={(e) => {
                          setEditAccreditationArea(e.target.value);
                          if (editErrors.area) setEditErrors((prev) => ({ ...prev, area: '' }));
                        }}
                      >
                        <option value="">Select accreditation area</option>
                        {ACCREDITATION_AREAS.map((area) => (
                          <option key={area.value} value={area.value}>
                            {area.label}
                          </option>
                        ))}
                      </select>
                      {editErrors.area && <span className="am-field-error">{editErrors.area}</span>}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>Academic Year</dt>
                <dd>{activity.academicYear}</dd>
              </div>
              <div>
                <dt>Department/Office Owner</dt>
                <dd>{formatUserOffice(activity.office || activity.department || activity.createdByOffice)}</dd>
              </div>
              <div>
                <dt>Created By</dt>
                <dd>{activity.createdByName || '-'}</dd>
              </div>
              <div>
                <dt>Creator Role</dt>
                <dd>{ROLE_LABELS[activity.createdByRole] || activity.createdByRole || '-'}</dd>
              </div>
              <div>
                <dt>Last Edited</dt>
                <dd>{formatDateTime(activity.updatedAt)}</dd>
              </div>
            </dl>

            <div className="am-description">
              <p className="am-section-label">Description</p>
              {!isEditing ? (
                <p>{activity.description || 'No description provided.'}</p>
              ) : (
                <div style={{ marginTop: '0.35rem' }}>
                  <textarea
                    className="am-textarea"
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Enter activity description..."
                  />
                </div>
              )}
            </div>

            {isEditing && (
              <div
                className="am-form-actions"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f3f4f6',
                }}
              >
                <button
                  type="button"
                  className="am-btn-primary"
                  disabled={isSaving}
                  onClick={handleSaveEdit}
                >
                  <Icon as={Check} size={14} /> {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="am-btn-secondary"
                  disabled={isSaving}
                  onClick={handleCancelEdit}
                >
                  <Icon as={X} size={14} /> Cancel
                </button>
              </div>
            )}
            {editSubmitError && <p className="am-alert am-alert-error" style={{ marginTop: '0.75rem' }}>{editSubmitError}</p>}
          </section>

          <div className="am-evidence-section">
            <EvidencePanel
              key={evidenceRefreshKey}
              activityId={activity.id}
              batchSelectionEnabled={canManageActivity}
              batchSelectedIds={batchSelectedIds}
              canManageEvidence={canCreateEvidence}
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
            defaultName={activity.activityName}
            title="Share Activity Evidence with Accreditors"
          />

          <ConfirmModal
            isOpen={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={async () => {
              await handleDelete();
              setDeleteConfirmOpen(false);
            }}
            title="Delete Activity"
            message={`Delete "${activity.activityName}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            busy={isDeleting}
          />
        </div>
      )}
    </ActivityShell>
  );
}
