import { Lock } from 'lucide-react';
import Icon from '../../../shared/components/Icon';

// Shown in place of an activity the signed-in person is not allowed to open, for example after
// following a link on a list (such as who references a shared file) to another department's activity.
export default function ActivityNoAccess({ onBack }) {
  return (
    <section className="am-panel am-panel-main" role="alert">
      <p className="am-section-label">
        <Icon as={Lock} size={13} /> Restricted
      </p>
      <h2 className="am-detail-title">You don&apos;t have access to this activity</h2>
      <p className="am-helper-text">
        It belongs to another department or office, so only people there can open it.
      </p>
      <div className="am-form-actions" style={{ marginTop: '0.85rem' }}>
        <button className="am-btn-secondary" type="button" onClick={onBack}>
          Go back
        </button>
      </div>
    </section>
  );
}
