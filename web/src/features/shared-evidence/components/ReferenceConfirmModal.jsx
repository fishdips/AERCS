import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { ACCREDITATION_AREAS, DEPARTMENTS, OFFICES, formatDepartment, formatOffice } from '../../activities/constants';
import { useAuth } from '../../../shared/hooks/useAuth';
import { createReference } from '../api';
import '../SharedEvidence.css';

export default function ReferenceConfirmModal({ evidence, activity, isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [area, setArea] = useState(activity?.accreditationArea ?? '');
  const [office, setOffice] = useState(user?.department || activity?.office || activity?.department || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setArea(activity?.accreditationArea ?? '');
    setOffice(user?.department || activity?.office || activity?.department || '');
  }, [activity, isOpen, user]);

  const handleClose = () => {
    setNote('');
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await createReference(evidence.id, {
        activityId: activity.id,
        referencedByOffice: office || null,
        accreditationArea: area || null,
        note: note || null,
      });
      setNote('');
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create reference.');
    } finally {
      setSaving(false);
    }
  };

  if (!evidence || !activity) return null;

  const officeOptions = [...DEPARTMENTS, ...OFFICES];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Reference">
      <div className="se-confirm-body">
        {error && <p className="am-alert am-alert-error">{error}</p>}

        <dl className="se-confirm-dl">
          <div>
            <dt>File</dt>
            <dd>{evidence.originalFileName}</dd>
          </div>
          <div>
            <dt>Office</dt>
            <dd>{evidence.office ? formatOffice(evidence.office) : evidence.department ? formatDepartment(evidence.department) : '-'}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{ACCREDITATION_AREAS.find((a) => a.value === evidence.accreditationArea)?.label ?? evidence.accreditationArea ?? '-'}</dd>
          </div>
          <div>
            <dt>Refs</dt>
            <dd>{evidence.referenceCount} {evidence.referenceCount === 1 ? 'office' : 'offices'}</dd>
          </div>
          <div>
            <dt>Target Activity</dt>
            <dd>{activity.activityName}</dd>
          </div>
        </dl>

        <div className="am-form-field">
          <label className="am-form-label se-filter-label" htmlFor="ref-office">Referencing Office</label>
          <select
            id="ref-office"
            className="am-select"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
          >
            <option value="">Use my office</option>
            {officeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="am-form-field">
          <label className="am-form-label se-filter-label" htmlFor="ref-area">Area Used In</label>
          <select
            id="ref-area"
            className="am-select"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">— same as activity —</option>
            {ACCREDITATION_AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="am-form-field">
          <label className="am-form-label se-filter-label" htmlFor="ref-note">Note (optional)</label>
          <textarea
            id="ref-note"
            className="am-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why are you referencing this file?"
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="se-confirm-actions">
          <button className="am-btn-secondary" type="button" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button className="am-btn-primary" type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Referencing…' : 'Confirm Reference'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
