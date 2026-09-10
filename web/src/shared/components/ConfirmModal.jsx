import Modal from './Modal';
import './ConfirmModal.css';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="confirm-modal">
        {typeof message === 'string' ? <p className="confirm-modal-message">{message}</p> : message}
        <div className="confirm-modal-actions">
          <button className="am-btn-secondary" type="button" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'am-btn-danger' : 'am-btn-primary'}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
