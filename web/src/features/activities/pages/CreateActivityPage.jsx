import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import ActivityShell from '../components/ActivityShell';
import ActivityWorkflowSidebar from '../components/ActivityWorkflowSidebar';
import { createActivity } from '../api';
import {
  ACCREDITATION_AREAS,
  ACTIVITY_TYPES,
  formatAccreditationArea,
  formatActivityType,
  formatDepartment,
  resolveUserDepartment,
  todayLocalISO,
} from '../constants';
import EvidencePanel from '../../evidence/components/EvidencePanel';
import BatchMetadataPanel from '../../evidence/components/BatchMetadataPanel';

const initialForm = {
  activityName: '',
  description: '',
  activityType: '',
  customActivityType: '',
  activityDate: '',
  accreditationArea: '',
  academicYear: '',
};

function hasMetadata(item) {
  return Boolean(item.evidenceType || item.relatedOffices?.length || item.tags?.length || item.notes);
}

function sectionClass(section, activeSection, complete, disabled = false) {
  return [
    'am-workflow-section',
    activeSection === section ? 'am-workflow-section-active' : '',
    complete ? 'am-workflow-section-complete' : '',
    disabled ? 'am-workflow-section-disabled' : '',
  ].filter(Boolean).join(' ');
}

function summaryValue(value, formatter) {
  if (!value) return '-';
  return formatter ? formatter(value) : value;
}

export default function CreateActivityPage() {
  const { user } = useAuth();
  const userDepartment = resolveUserDepartment(user);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdActivity, setCreatedActivity] = useState(null);
  const [activeSection, setActiveSection] = useState('create');
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (form.activityType !== 'OTHER' && form.customActivityType) {
      setForm((current) => ({ ...current, customActivityType: '' }));
    }
  }, [form.activityType, form.customActivityType]);

  const canUpload = Boolean(createdActivity);
  const canAssignMetadata = evidenceItems.length > 0 && !isUploading;
  const metadataComplete = evidenceItems.length > 0 && evidenceItems.every(hasMetadata);

  const disabledSteps = useMemo(() => {
    const steps = [];
    if (!createdActivity) steps.push('upload', 'metadata');
    else if (!canAssignMetadata) steps.push('metadata');
    return steps;
  }, [createdActivity, canAssignMetadata]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.activityName.trim()) nextErrors.activityName = 'Activity title is required';
    if (!form.activityType) nextErrors.activityType = 'Activity type is required';
    if (form.activityType === 'OTHER' && !form.customActivityType.trim()) {
      nextErrors.customActivityType = 'Custom activity type is required';
    }
    if (!form.activityDate) nextErrors.activityDate = 'Activity date is required';
    if (form.activityDate && form.activityDate > todayLocalISO()) {
      nextErrors.activityDate = 'Activity date cannot be in the future';
    }
    if (!userDepartment) nextErrors.department = 'Your account has no assigned department';
    if (!form.accreditationArea) nextErrors.accreditationArea = 'Accreditation area is required';
    if (!form.academicYear.trim()) nextErrors.academicYear = 'Academic year is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setActiveSection('create');
    setSubmitError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        activityName: form.activityName.trim(),
        description: form.description.trim(),
        activityType: form.activityType,
        customActivityType: form.activityType === 'OTHER' ? form.customActivityType.trim() : null,
        activityDate: form.activityDate,
        accreditationArea: form.accreditationArea,
        academicYear: form.academicYear.trim(),
      };
      const { data } = await createActivity(payload);
      setCreatedActivity(data);
      setActiveSection('upload');
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(details);
      setSubmitError(err.response?.data?.error || 'Failed to save activity. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvidenceChange = useCallback((items) => {
    setEvidenceItems(items);
    setBatchSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, []);

  const handleSelectAllBatchEligible = (items) => {
    const eligibleIds = items.filter((item) => !hasMetadata(item)).map((item) => item.id);
    setBatchSelectedIds((current) => (
      eligibleIds.length > 0 && eligibleIds.every((id) => current.includes(id)) ? [] : eligibleIds
    ));
    if (eligibleIds.length > 0) setActiveSection('metadata');
  };

  const handleToggleBatchSelection = (item) => {
    if (!item) return;
    setBatchSelectedIds((current) => (
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
    ));
    setActiveSection('metadata');
  };

  const handleStepSelect = (step) => {
    if (step === 'upload' && !canUpload) return;
    if (step === 'metadata' && !canAssignMetadata) return;
    setActiveSection(step);
  };

  const handleMetadataSaved = () => {
    setBatchSelectedIds([]);
    setMetadataRefreshKey((current) => current + 1);
    setActiveSection('metadata');
  };

  const activitySummary = createdActivity || {
    activityName: form.activityName,
    owner: user?.name,
    department: userDepartment,
    activityType: form.activityType,
    customActivityType: form.customActivityType,
    academicYear: form.academicYear,
    accreditationArea: form.accreditationArea,
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Create</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Evidence Workflow</h1>
        <div className="am-page-actions">
          <Link className="am-btn-secondary" to="/activities">Back</Link>
        </div>
      </div>

      <div className="am-workflow-layout">
        <div className="am-workflow-main">
          <section
            className={sectionClass('create', activeSection, Boolean(createdActivity))}
            onFocusCapture={() => setActiveSection('create')}
            onClick={() => setActiveSection('create')}
          >
            <div className="am-section-heading-row">
              <div>
                <p className="am-section-label">Create Activity</p>
                <h2 className="am-section-title">Office and activity details</h2>
              </div>
              {createdActivity && <span className="am-status-pill">Created</span>}
            </div>

            <form id="create-activity-form" className="am-form am-create-form am-form-embedded" onSubmit={handleSubmit} noValidate>
              {submitError && <p className="am-alert am-alert-error">{submitError}</p>}

              <div className="am-form-grid">
                <label className="am-form-field">
                  <span className="am-form-label">Owner</span>
                  <input className="am-input" value={user?.name || ''} readOnly disabled />
                </label>

                <label className="am-form-field">
                  <span className="am-form-label">Department Owner <span className="am-required">*</span></span>
                  <input className="am-input" value={formatDepartment(userDepartment)} readOnly disabled />
                  {errors.department && <span className="am-field-error">{errors.department}</span>}
                </label>

                <label className="am-form-field am-form-field-wide">
                  <span className="am-form-label">Activity Title <span className="am-required">*</span></span>
                  <input
                    className="am-input"
                    placeholder="Activity title"
                    value={form.activityName}
                    onChange={(e) => updateField('activityName', e.target.value)}
                    disabled={Boolean(createdActivity)}
                  />
                  {errors.activityName && <span className="am-field-error">{errors.activityName}</span>}
                </label>

                <label className="am-form-field">
                  <span className="am-form-label">Activity Type <span className="am-required">*</span></span>
                  <select
                    className="am-select"
                    value={form.activityType}
                    onChange={(e) => updateField('activityType', e.target.value)}
                    disabled={Boolean(createdActivity)}
                  >
                    <option value="">Select type</option>
                    {ACTIVITY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  {errors.activityType && <span className="am-field-error">{errors.activityType}</span>}
                </label>

                {form.activityType === 'OTHER' && (
                  <label className="am-form-field">
                    <span className="am-form-label">Custom Activity Type <span className="am-required">*</span></span>
                    <input
                      className="am-input"
                      placeholder="Enter activity type"
                      value={form.customActivityType}
                      onChange={(e) => updateField('customActivityType', e.target.value)}
                      disabled={Boolean(createdActivity)}
                    />
                    {errors.customActivityType && <span className="am-field-error">{errors.customActivityType}</span>}
                  </label>
                )}

                <label className="am-form-field">
                  <span className="am-form-label">Activity Date <span className="am-required">*</span></span>
                  <input
                    className="am-input"
                    type="date"
                    value={form.activityDate}
                    onChange={(e) => updateField('activityDate', e.target.value)}
                    disabled={Boolean(createdActivity)}
                  />
                  {errors.activityDate && <span className="am-field-error">{errors.activityDate}</span>}
                </label>

                <label className="am-form-field">
                  <span className="am-form-label">Accreditation Area <span className="am-required">*</span></span>
                  <select
                    className="am-select"
                    value={form.accreditationArea}
                    onChange={(e) => updateField('accreditationArea', e.target.value)}
                    disabled={Boolean(createdActivity)}
                  >
                    <option value="">Select area</option>
                    {ACCREDITATION_AREAS.map((area) => (
                      <option key={area.value} value={area.value}>{area.label}</option>
                    ))}
                  </select>
                  {errors.accreditationArea && <span className="am-field-error">{errors.accreditationArea}</span>}
                </label>

                <label className="am-form-field">
                  <span className="am-form-label">Academic Year <span className="am-required">*</span></span>
                  <input
                    className="am-input"
                    placeholder="2025-2026"
                    value={form.academicYear}
                    onChange={(e) => updateField('academicYear', e.target.value)}
                    disabled={Boolean(createdActivity)}
                  />
                  {errors.academicYear && <span className="am-field-error">{errors.academicYear}</span>}
                </label>

                <label className="am-form-field am-form-field-wide">
                  <span className="am-form-label">Description</span>
                  <textarea
                    className="am-textarea"
                    rows={4}
                    placeholder="Short description"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    disabled={Boolean(createdActivity)}
                  />
                </label>
              </div>

              <div className="am-form-actions">
                <button className="am-btn-primary" type="submit" disabled={isSubmitting || Boolean(createdActivity)}>
                  {createdActivity ? 'Activity Created' : isSubmitting ? 'Saving...' : 'Create Activity'}
                </button>
              </div>
            </form>
          </section>

          <section
            className={sectionClass('upload', activeSection, evidenceItems.length > 0, !canUpload)}
            onFocusCapture={() => canUpload && setActiveSection('upload')}
            onClick={() => canUpload && setActiveSection('upload')}
          >
            <div className="am-section-heading-row">
              <div>
                <p className="am-section-label">Upload Evidence</p>
                <h2 className="am-section-title">Uploaded evidence files</h2>
              </div>
              {evidenceItems.length > 0 && <span className="am-status-pill">{evidenceItems.length} uploaded</span>}
            </div>

            {createdActivity && (
              <section className="am-panel am-summary-panel">
                <dl className="am-summary-list">
                  <div><dt>Activity Name</dt><dd>{summaryValue(activitySummary.activityName)}</dd></div>
                  <div><dt>Owner</dt><dd>{summaryValue(activitySummary.createdByName || activitySummary.owner)}</dd></div>
                  <div><dt>Department</dt><dd>{summaryValue(activitySummary.department, formatDepartment)}</dd></div>
                  <div><dt>Activity Type</dt><dd>{formatActivityType(activitySummary.activityType, activitySummary.customActivityType)}</dd></div>
                  <div><dt>Academic Year</dt><dd>{summaryValue(activitySummary.academicYear)}</dd></div>
                  <div><dt>Accreditation Area</dt><dd>{summaryValue(activitySummary.accreditationArea, formatAccreditationArea)}</dd></div>
                </dl>
              </section>
            )}

            {!createdActivity ? (
              <div className="am-evidence-placeholder"><span>Create the activity before uploading evidence.</span></div>
            ) : (
              <EvidencePanel
                key={`${createdActivity.id}-${metadataRefreshKey}`}
                activityId={createdActivity.id}
                canManageEvidence
                batchSelectionEnabled
                batchSelectedIds={batchSelectedIds}
                hideMetadataActions
                lockManagementActions={isUploading}
                onEvidenceChange={handleEvidenceChange}
                onSelectAllBatchEligible={handleSelectAllBatchEligible}
                onToggleBatchSelection={handleToggleBatchSelection}
                onUploadStateChange={setIsUploading}
                onUploaded={() => setActiveSection('metadata')}
                title="Uploaded Evidence"
              />
            )}
          </section>

          <section
            className={sectionClass('metadata', activeSection, metadataComplete, !canAssignMetadata)}
            onFocusCapture={() => canAssignMetadata && setActiveSection('metadata')}
            onClick={() => canAssignMetadata && setActiveSection('metadata')}
          >
            <div className="am-section-heading-row">
              <div>
                <p className="am-section-label">Assign Metadata</p>
                <h2 className="am-section-title">Assign metadata to selected evidence files</h2>
              </div>
              {metadataComplete && <span className="am-status-pill">Complete</span>}
            </div>

            {!createdActivity ? (
              <div className="am-evidence-placeholder"><span>Create the activity first.</span></div>
            ) : evidenceItems.length === 0 ? (
              <div className="am-evidence-placeholder"><span>Upload at least one evidence file before assigning metadata.</span></div>
            ) : (
              <BatchMetadataPanel
                activityId={createdActivity.id}
                evidence={evidenceItems}
                hideEvidenceSelection
                selectedIds={batchSelectedIds}
                onSelectedIdsChange={setBatchSelectedIds}
                onSaved={handleMetadataSaved}
              />
            )}
          </section>
        </div>

        <ActivityWorkflowSidebar
          activeStep={activeSection}
          activityId={createdActivity?.id}
          disabledSteps={disabledSteps}
          onStepSelect={handleStepSelect}
        />
      </div>
    </ActivityShell>
  );
}
