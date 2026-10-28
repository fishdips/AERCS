import { useEffect } from 'react';
import { X } from 'lucide-react';
import Icon from './Icon';

const DEFAULT_AUTO_DISMISS_MS = 6000;

// Dismissible inline banner used for the app's `am-alert` success/error
// messages. Shows a close button and auto-dismisses after a few seconds so
// a stale message doesn't linger on screen; pass autoDismissMs={0} to
// disable the timer for a message the user must act on/acknowledge.
export default function Alert({ type = 'error', message, onDismiss, autoDismissMs = DEFAULT_AUTO_DISMISS_MS, style }) {
  useEffect(() => {
    if (!message || !onDismiss || !autoDismissMs) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, autoDismissMs]);

  if (!message) return null;

  return (
    <p className={`am-alert am-alert-${type}`} style={style}>
      <span className="am-alert-text">{message}</span>
      {onDismiss && (
        <button type="button" className="am-alert-close" onClick={onDismiss} aria-label="Dismiss">
          <Icon as={X} size={13} />
        </button>
      )}
    </p>
  );
}
