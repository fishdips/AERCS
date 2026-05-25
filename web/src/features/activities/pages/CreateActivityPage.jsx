import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ActivityShell from '../components/ActivityShell';
import { createActivity, listActivities } from '../api';
import { ACCREDITATION_AREAS, ACTIVITY_TYPES, DEPARTMENTS, OFFICES, formatActivityType } from '../constants';

const initialForm = {
  activityName: '',
  description: '',
  activityType: '',
  activityDate: '',
  department: '',
  office: '',
  accreditationArea: '',
  academicYear: '',
};

const workflowSteps = [
  'Create Activity',
  'Upload Evidence',
  'Assign Metadata',
  'Categorize',
];

function formatShortDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

export default function CreateActivityPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    const loadRecentActivities = async () => {
      try {
        const { data } = await listActivities();
        setRecentActivities((data || []).slice(0, 3));
      } catch {
        setRecentActivities([]);
      }
    };

    loadRecentActivities();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.activityName.trim()) nextErrors.activityName = 'Activity title is required';
    if (!form.activityType) nextErrors.activityType = 'Activity type is required';
    if (!form.activityDate) nextErrors.activityDate = 'Activity date is required';
    if (form.activityDate && form.activityDate > new Date().toISOString().slice(0, 10)) {
      nextErrors.activityDate = 'Activity date cannot be in the future';
    }
    if (!form.department && !form.office) {
      nextErrors.department = 'Department or office is required';
      nextErrors.office = 'Department or office is required';
    }
    if (!form.accreditationArea) nextErrors.accreditationArea = 'Accreditation area is required';
    if (!form.academicYear.trim()) nextErrors.academicYear = 'Academic year is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        activityName: form.activityName.trim(),
        description: form.description.trim(),
        department: form.department.trim(),
        office: form.office.trim(),
        academicYear: form.academicYear.trim(),
      };
      const { data } = await createActivity(payload);
      navigate(`/activities/${data.id}`, {
        replace: true,
        state: { message: 'Activity record created.' },
      });
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) {
        setErrors(details);
      }
      setSubmitError(err.response?.data?.error || 'Failed to save activity. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Create</p>
      <div className="am-page-header">
        <h1 className="am-page-title">New Activity</h1>
        <div className="am-page-actions">
          <Link className="am-btn-secondary" to="/activities">Cancel</Link>
          <button className="am-btn-primary" type="submit" form="create-activity-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Create Activity'}
          </button>
        </div>
      </div>

      <div className="am-create-layout">
        <form id="create-activity-form" className="am-form am-create-form" onSubmit={handleSubmit} noValidate>
          {submitError && <p className="am-alert am-alert-error">{submitError}</p>}

          <div className="am-form-grid">
            <label className="am-form-field am-form-field-wide">
              <span className="am-form-label">Activity Title <span className="am-required">*</span></span>
              <input
                className="am-input"
                placeholder="Activity title"
                value={form.activityName}
                onChange={(e) => updateField('activityName', e.target.value)}
              />
              {errors.activityName && <span className="am-field-error">{errors.activityName}</span>}
            </label>

            <label className="am-form-field am-form-field-wide">
              <span className="am-form-label">Description</span>
              <textarea
                className="am-textarea"
                rows={4}
                placeholder="Short description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Activity Type <span className="am-required">*</span></span>
              <select
                className="am-select"
                value={form.activityType}
                onChange={(e) => updateField('activityType', e.target.value)}
              >
                <option value="">Select type</option>
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.activityType && <span className="am-field-error">{errors.activityType}</span>}
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Activity Date <span className="am-required">*</span></span>
              <input
                className="am-input"
                type="date"
                value={form.activityDate}
                onChange={(e) => updateField('activityDate', e.target.value)}
              />
              {errors.activityDate && <span className="am-field-error">{errors.activityDate}</span>}
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Department <span className="am-required">*</span></span>
              <select
                className="am-select"
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
              >
                <option value="">Select department</option>
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              {errors.department && <span className="am-field-error">{errors.department}</span>}
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Office <span className="am-required">*</span></span>
              <select
                className="am-select"
                value={form.office}
                onChange={(e) => updateField('office', e.target.value)}
              >
                <option value="">Select office</option>
                {OFFICES.map((office) => (
                  <option key={office} value={office}>{office}</option>
                ))}
              </select>
              {errors.office && <span className="am-field-error">{errors.office}</span>}
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Accreditation Area <span className="am-required">*</span></span>
              <select
                className="am-select"
                value={form.accreditationArea}
                onChange={(e) => updateField('accreditationArea', e.target.value)}
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
              />
              {errors.academicYear && <span className="am-field-error">{errors.academicYear}</span>}
            </label>
          </div>

          <div className="am-form-actions">
            <button className="am-btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Create Activity'}
            </button>
            <Link className="am-btn-secondary" to="/activities">Cancel</Link>
          </div>
        </form>

        <aside className="am-create-rail">
          <section className="am-side-panel">
            <p className="am-section-label">Workflow</p>
            <ol className="am-workflow-list">
              {workflowSteps.map((step, index) => (
                <li className={index === 0 ? 'am-workflow-active' : ''} key={step}>
                  <span>{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="am-side-panel">
            <p className="am-section-label">Recent Activities</p>
            {recentActivities.length === 0 ? (
              <p className="am-empty-inline">No activities yet.</p>
            ) : (
              <div className="am-recent-list">
                {recentActivities.map((activity) => (
                  <Link className="am-recent-item" to={`/activities/${activity.id}`} key={activity.id}>
                    <span>{activity.activityName}</span>
                    <small>{formatShortDate(activity.activityDate)} · {formatActivityType(activity.activityType)}</small>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </ActivityShell>
  );
}
