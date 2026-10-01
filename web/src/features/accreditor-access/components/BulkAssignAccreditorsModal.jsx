import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { assignAccreditors } from '../api';
import AccreditorPicker from './AccreditorPicker';

// Adds the chosen accreditors to every selected link at once. Accreditors already
// assigned to a link keep their access; nobody is removed.
export default function BulkAssignAccreditorsModal({ links, onClose, onSaved }) {
  const [accreditorIds, setAccreditorIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isOpen = links.length > 0;

  useEffect(() => {
    if (isOpen) {
      setAccreditorIds([]);
      setError('');
    }
  }, [isOpen]);

  const handleAssign = async () => {
    if (accreditorIds.length === 0) {
      setError('Select at least one accreditor.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await assignAccreditors(links.map((l) => l.id), accreditorIds);
      onSaved(data.emailFailures || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign accreditors.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Accreditors">
      <div className="aa-generate">
        {error && <p className="am-alert am-alert-error">{error}</p>}

        <div className="aa-generate-summary">
          <span>{links.length} link{links.length === 1 ? '' : 's'} selected</span>
          <ul className="aa-bulk-link-list">
            {links.map((l) => <li key={l.id}>{l.name}</li>)}
          </ul>
        </div>

        <div className="am-form-field">
          <span className="am-form-label">Give these accreditors access</span>
          {isOpen && <AccreditorPicker value={accreditorIds} onChange={setAccreditorIds} disabled={saving} />}
        </div>

        <div className="aa-actions">
          <button className="am-btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="am-btn-primary" type="button" onClick={handleAssign} disabled={saving}>
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
