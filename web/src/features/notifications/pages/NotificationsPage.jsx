import { useNavigate } from 'react-router-dom';
import { CheckCheck, RefreshCw, Share2, Tag, Unlink, Upload } from 'lucide-react';
import ActivityShell from '../../activities/components/ActivityShell';
import Icon from '../../../shared/components/Icon';
import InfoTooltip from '../../../shared/components/InfoTooltip';
import { useStaffNotifications } from '../context/StaffNotificationsContext';
import { describeStaffNotification, timeAgo } from '../notificationText';
// The notice list reuses the accreditor Notifications styling so both tabs look the same.
import '../../accreditor-access/AccreditorAccess.css';

const KIND_ICONS = {
  upload: Upload,
  tag: Tag,
  version: RefreshCw,
  reference: Share2,
  removed: Unlink,
};

// The Notifications tab for department staff, chairpersons and institutional staff: evidence added
// to your department's or office's activities, new versions, and other offices referencing your
// evidence. The notifications come from the shared provider, which keeps them up to date, so this
// only displays them and records what has been read.
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loaded, failed, now, markRead, markAllRead } = useStaffNotifications();

  const handleOpen = (notification) => {
    const view = describeStaffNotification(notification);
    markRead(notification.id);
    if (view.path) navigate(view.path);
  };

  return (
    <ActivityShell>
      <div className="am-page-header">
        <div className="am-page-header-left">
          <h1 className="am-page-title">Notifications</h1>
          <InfoTooltip text="Evidence uploaded to your department or office's activities, evidence tagged for your department or office, new versions, and other offices referencing your evidence. Everyone in your department or office is notified." />
        </div>
      </div>

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
            No notifications yet. You will be told here when evidence is uploaded to your activities
            and when another office references your evidence.
          </p>
        )}

        {notifications.length > 0 && (
          <ul className="aa-notifications-list">
            {notifications.map((notification) => {
              const view = describeStaffNotification(notification);
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
                      <Icon as={KIND_ICONS[view.kind]} size={16} />
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
    </ActivityShell>
  );
}
