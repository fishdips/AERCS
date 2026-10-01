import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { generateAccreditorAccess } from '../api';
import AccreditorPicker from './AccreditorPicker';
import '../AccreditorAccess.css';

function defaultExpiration() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function GenerateAccreditorAccessModal({
  isOpen,
  onClose,
  evidenceIds,
  activityId,
  defaultName = '',
  title = 'Share with Accreditors',
}) {
  const [name, setName] = useState(defaultName);
  const [accreditorIds, setAccreditorIds] = useState([]);
  const [expiration, setExpiration] = useState(defaultExpiration());
  const [notes, setNotes] = useState('');
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The activity name usually arrives after the modal is mounted, so prefill on open.
  useEffect(() => {
    if (isOpen && !generated) setName((current) => current || defaultName);
  }, [isOpen, defaultName, generated]);

  const handleClose = () => {
    setGenerated(null);
    setError('');
    setName(defaultName);
    setAccreditorIds([]);
    setNotes('');
    setExpiration(defaultExpiration());
    onClose();
  };

  const handleGenerate = async () => {
    if (!name.trim()) {
      setError('Give this link a name so accreditors know what it contains.');
      return;
    }
    if (accreditorIds.length === 0) {
      setError('Select at least one accreditor.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        accreditorIds,
        expirationDateTime: expiration ? new Date(expiration).toISOString() : null,
        notes: notes || null,
      };
      if (activityId) payload.activityId = activityId;
      if (evidenceIds?.length) payload.evidenceIds = evidenceIds;

      const { data } = await generateAccreditorAccess(payload);
      setGenerated(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create the accreditor access link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="aa-generate">
        {error && <p className="am-alert am-alert-error">{error}</p>}

        {generated ? (
          <div className="aa-generated-link">
            <span>Link created</span>
            <strong>{generated.name}</strong>
            <small>
              {generated.evidenceCount} file(s) · shared with {generated.accreditorCount} accreditor(s)
              · expires {new Date(generated.expiresAt).toLocaleString()}
            </small>
            <small>Assigned accreditors will see it under Evidence Links after they log in.</small>
            {generated.emailFailures?.length > 0 && (
              <small className="aa-warning">
                Notification email could not be sent to: {generated.emailFailures.join(', ')}.
                They can still see the link when they log in.
              </small>
            )}
          </div>
        ) : (
          <>
            <div className="aa-generate-summary">
              <span>Read-only evidence access</span>
              <strong>{activityId ? 'Uploaded and referenced activity evidence' : `${evidenceIds?.length || 0} selected file(s)`}</strong>
            </div>

            <div className="am-form-field">
              <label className="am-form-label" htmlFor="aa-name">Link Name <span className="am-required">*</span></label>
              <input
                id="aa-name"
                className="am-input"
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Area VII – Research: 2025 Faculty Publications"
              />
            </div>

            <div className="am-form-field">
              <span className="am-form-label">Accreditors <span className="am-required">*</span></span>
              <AccreditorPicker value={accreditorIds} onChange={setAccreditorIds} disabled={saving} />
            </div>

            <div className="am-form-field">
              <label className="am-form-label" htmlFor="aa-expiration">Expires At</label>
              <input
                id="aa-expiration"
                className="am-input"
                type="datetime-local"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
              />
            </div>

            <div className="am-form-field">
              <label className="am-form-label" htmlFor="aa-notes">Notes</label>
              <textarea
                id="aa-notes"
                className="am-textarea"
                rows={3}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context shown to the accreditor"
              />
            </div>
          </>
        )}

        <div className="aa-actions">
          <button className="am-btn-secondary" type="button" onClick={handleClose} disabled={saving}>
            Close
          </button>
          {!generated && (
            <button className="am-btn-primary" type="button" onClick={handleGenerate} disabled={saving}>
              {saving ? 'Creating...' : 'Create Link'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
