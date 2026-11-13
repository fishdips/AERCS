import { useNavigate } from 'react-router-dom';
import { AlarmClock, CheckCheck, Clock, Share2 } from 'lucide-react';
import Icon from '../../../shared/components/Icon';
import { useAccreditorNotifications } from '../context/AccreditorNotificationsContext';
import { describeNotification, timeAgo } from '../notificationText';

const TONE_ICONS = {
  info: Share2,
  warning: Clock,
  urgent: AlarmClock,
  expired: Clock,
};

// The list on the accreditor's Notifications page: links shared with them, and links that expire
// within 24 hours or 4 hours. The notifications themselves come from the shared provider, which
// keeps them up to date, so this only displays them and records what has been read.
export default function AccreditorNotifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loaded, failed, now, markRead, markAllRead } = useAccreditorNotifications();

  const handleOpen = (notification) => {
    const view = describeNotification(notification, now);
    markRead(notification.id);
    if (view.canOpen) {
      navigate(`/accreditor/links/${notification.linkId}`);
    }
  };

  return (
    <section className="aa-notifications" aria-label="Notifications">
      {notifications.length > 0 && (
        <div className="aa-notifications-head">
          <span className="aa-notifications-summary">
            {unreadCount > 0 ? <strong>{unreadCount} unread</strong> : 'All caught up'}
          </span>
          <button
            type="button"
            className="aa-notifications-markall"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <Icon as={CheckCheck} size={14} /> Mark all as read
          </button>
        </div>
      )}

      {!loaded && <p className="aa-notifications-empty">Loading notifications...</p>}
      {loaded && failed && notifications.length === 0 && (
        <p className="aa-notifications-empty">Notifications could not be loaded right now.</p>
      )}
      {loaded && !failed && notifications.length === 0 && (
        <p className="aa-notifications-empty">
          No notifications yet. You will be told here when evidence is shared with you and when a link is about to expire.
        </p>
      )}

      {notifications.length > 0 && (
        <ul className="aa-notifications-list">
          {notifications.map((notification) => {
            const view = describeNotification(notification, now);
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  className={[
                    'aa-notice',
                    `aa-notice-${view.tone}`,
                    notification.read ? 'aa-notice-read' : 'aa-notice-unread',
                  ].join(' ')}
                  onClick={() => handleOpen(notification)}
                >
                  <span className="aa-notice-icon" aria-hidden="true">
                    <Icon as={TONE_ICONS[view.tone]} size={16} />
                  </span>
                  <span className="aa-notice-text">
                    <strong>
                      {view.title}
                      {!notification.read && <span className="aa-notice-dot" aria-label="Unread" />}
                    </strong>
                    <span className="aa-notice-body">{view.body}</span>
                    <span className="aa-notice-time">{timeAgo(notification.createdAt, now)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
