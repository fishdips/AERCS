import { useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { generateAccreditorAccess } from '../api';
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
  title = 'Generate Accreditor Access',
}) {
  const [expiration, setExpiration] = useState(defaultExpiration());
  const [notes, setNotes] = useState('');
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setGenerated(null);
    setError('');
    setNotes('');
    setExpiration(defaultExpiration());
    onClose();
  };

  const handleGenerate = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        expirationDateTime: expiration ? new Date(expiration).toISOString() : null,
        notes: notes || null,
      };
      if (activityId) payload.activityId = activityId;
      if (evidenceIds?.length) payload.evidenceIds = evidenceIds;

      const { data } = await generateAccreditorAccess(payload);
      setGenerated(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate accreditor access link.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!generated?.accessUrl) return;
    await navigator.clipboard?.writeText(generated.accessUrl);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="aa-generate">
        {error && <p className="am-alert am-alert-error">{error}</p>}

        <div className="aa-generate-summary">
          <span>Read-only evidence access</span>
          <strong>{activityId ? 'Uploaded and referenced activity evidence' : `${evidenceIds?.length || 0} selected file(s)`}</strong>
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
            placeholder="Optional context for this access link"
          />
        </div>

        {generated && (
          <div className="aa-generated-link">
            <span>Temporary Link</span>
            <a href={generated.accessUrl} target="_blank" rel="noreferrer">{generated.accessUrl}</a>
            <button className="am-btn-secondary" type="button" onClick={copyLink}>Copy Link</button>
          </div>
        )}

        <div className="aa-actions">
          <button className="am-btn-secondary" type="button" onClick={handleClose} disabled={saving}>
            Close
          </button>
          <button className="am-btn-primary" type="button" onClick={handleGenerate} disabled={saving}>
            {saving ? 'Generating...' : 'Generate Link'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
