import ActivityShell from '../../activities/components/ActivityShell';
import AccreditorNotifications from '../components/AccreditorNotifications';
import '../AccreditorAccess.css';

// The accreditor's Notifications tab.
export default function AccreditorNotificationsPage() {
  return (
    <ActivityShell>
      <div className="am-page-header">
        <div className="am-page-header-left">
          <h1 className="am-page-title">Notifications</h1>
          <p className="am-description">
            Evidence shared with you, and reminders when one of your links has 24 hours or 4 hours left.
          </p>
        </div>
      </div>

      <AccreditorNotifications />
    </ActivityShell>
  );
}
