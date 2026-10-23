import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import {
  formatAccreditationArea,
  formatDepartment,
  formatOffice,
  formatUserOffice,
} from '../../activities/constants';
import { useAuth } from '../../../shared/hooks/useAuth';
import { createReference } from '../api';
import Alert from '../../../shared/components/Alert';
import '../SharedEvidence.css';

export default function ReferenceConfirmModal({ evidence, activity, isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
  }, [isOpen]);

  // Always the target activity's own office and accreditation area - not a
  // choice the user makes here, so staff can't reference a file in under a
  // different office/area than where it's actually being used.
  const referencingOffice = user?.office || activity?.office || activity?.department || null;
  const referencingArea = activity?.accreditationArea || null;

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
        referencedByOffice: referencingOffice,
        accreditationArea: referencingArea,
        note: note || null,
      });
      setNote('');
      onSuccess(evidence);
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create reference.');
    } finally {
      setSaving(false);
    }
  };

  if (!evidence || !activity) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Reference">
      <div className="se-confirm-body">
        <Alert type="error" message={error} onDismiss={() => setError('')} />

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
            <dd>{formatAccreditationArea(evidence.accreditationArea)}</dd>
          </div>
          <div>
            <dt>Refs</dt>
            <dd>{evidence.referenceCount} {evidence.referenceCount === 1 ? 'office' : 'offices'}</dd>
          </div>
          <div>
            <dt>Target Activity</dt>
            <dd>{activity.activityName}</dd>
          </div>
          <div>
            <dt>Referencing Office</dt>
            <dd>{formatUserOffice(referencingOffice)}</dd>
          </div>
          <div>
            <dt>Area Used In</dt>
            <dd>{formatAccreditationArea(referencingArea)}</dd>
          </div>
        </dl>

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
            {saving ? 'Referencing...' : 'Confirm Reference'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
