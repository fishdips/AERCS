import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { updateAccreditorAccess } from '../api';
import AccreditorPicker from './AccreditorPicker';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

// Rename a link, change its expiry, or change exactly which accreditors can open it.
export default function EditAccreditorLinkModal({ link, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [expiration, setExpiration] = useState('');
  const [accreditorIds, setAccreditorIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!link) return;
    setName(link.name);
    setExpiration(toLocalInput(link.expiresAt));
    setAccreditorIds(link.accreditors.map((a) => a.id));
    setError('');
  }, [link]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Link name is required.');
      return;
    }
    if (accreditorIds.length === 0) {
      setError('Select at least one accreditor.');
      return;
    }
    const payload = { name: name.trim(), accreditorIds };
    // Only send the expiry when it changed, so an already-expired link can still be renamed.
    if (expiration && expiration !== toLocalInput(link.expiresAt)) {
      payload.expiresAt = new Date(expiration).toISOString();
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await updateAccreditorAccess(link.id, payload);
      onSaved(data.emailFailures || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update the access link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(link)} onClose={onClose} title="Edit Accreditor Link">
      <div className="aa-generate">
        {error && <p className="am-alert am-alert-error">{error}</p>}

        <div className="am-form-field">
          <label className="am-form-label" htmlFor="aa-edit-name">Link Name <span className="am-required">*</span></label>
          <input
            id="aa-edit-name"
            className="am-input"
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="am-form-field">
          <label className="am-form-label" htmlFor="aa-edit-expiration">Expires At</label>
          <input
            id="aa-edit-expiration"
            className="am-input"
            type="datetime-local"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
          />
        </div>

        <div className="am-form-field">
          <span className="am-form-label">Accreditors <span className="am-required">*</span></span>
          {link && <AccreditorPicker value={accreditorIds} onChange={setAccreditorIds} disabled={saving} />}
        </div>

        <div className="aa-actions">
          <button className="am-btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="am-btn-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
