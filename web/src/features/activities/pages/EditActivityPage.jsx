import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ActivityShell from '../components/ActivityShell';
import { getActivity, updateActivity } from '../api';
import { ACCREDITATION_AREAS, ACTIVITY_TYPES, OFFICES, formatDepartment } from '../constants';

const initialForm = {
  activityName: '',
  description: '',
  activityType: '',
  customActivityType: '',
  activityDate: '',
  department: '',
  office: '',
  accreditationArea: '',
  academicYear: '',
};

export default function EditActivityPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await getActivity(id);
      setForm({
        activityName: data.activityName || '',
        description: data.description || '',
        activityType: data.activityType || '',
        customActivityType: data.customActivityType || '',
        activityDate: data.activityDate || '',
        department: data.department || '',
        office: data.office || '',
        accreditationArea: data.accreditationArea || '',
        academicYear: data.academicYear || '',
      });
    } catch {
      setLoadError('Activity not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

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
    if (form.activityDate && form.activityDate > new Date().toISOString().slice(0, 10)) {
      nextErrors.activityDate = 'Activity date cannot be in the future';
    }
    if (!form.department) nextErrors.department = 'Department is required';
    if (!form.office) nextErrors.office = 'Office is required';
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
        customActivityType: form.customActivityType.trim() || null,
        office: form.office || null,
        academicYear: form.academicYear.trim(),
      };
      await updateActivity(id, payload);
      navigate(`/activities/${id}`, {
        replace: true,
        state: { message: 'Activity record updated.' },
      });
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) {
        setErrors(details);
      }
      setSubmitError(err.response?.data?.error || 'Failed to update activity. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Activities / Edit</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Edit Activity</h1>
        <Link className="am-btn-secondary" to={`/activities/${id}`}>Cancel</Link>
      </div>

      {loadError && <p className="am-alert am-alert-error">{loadError}</p>}
      {loading && <p className="am-empty am-empty-plain">Loading activity...</p>}

      {!loading && !loadError && (
        <form className="am-form" onSubmit={handleSubmit} noValidate>
          {submitError && <p className="am-alert am-alert-error">{submitError}</p>}

          <div className="am-form-grid">
            <label className="am-form-field am-form-field-wide">
              <span className="am-form-label">Activity Title <span className="am-required">*</span></span>
              <input
                className="am-input"
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
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Activity Type <span className="am-required">*</span></span>
              <select
                className="am-select"
                value={form.activityType}
                onChange={(e) => {
                  updateField('activityType', e.target.value);
                  if (e.target.value !== 'OTHER') updateField('customActivityType', '');
                }}
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
                  value={form.customActivityType}
                  onChange={(e) => updateField('customActivityType', e.target.value)}
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
              />
              {errors.activityDate && <span className="am-field-error">{errors.activityDate}</span>}
            </label>

            <label className="am-form-field">
              <span className="am-form-label">Department <span className="am-required">*</span></span>
              <input className="am-input" value={formatDepartment(form.department)} readOnly disabled />
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
                {OFFICES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link className="am-btn-secondary" to={`/activities/${id}`}>Cancel</Link>
          </div>
        </form>
      )}
    </ActivityShell>
  );
}
