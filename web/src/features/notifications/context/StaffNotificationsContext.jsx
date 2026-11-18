import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { NOTIFICATION_ROLES } from '../../../shared/constants/roles';
import { getStaffNotifications, markAllStaffNotificationsRead, markStaffNotificationRead } from '../api';

// What anything outside the provider sees: no notifications, nothing to do.
const NONE = {
  unreadCount: 0,
  notifications: [],
  loaded: false,
  failed: false,
  now: 0,
  markRead: () => {},
  markAllRead: () => {},
  refresh: () => {},
};

const StaffNotificationsContext = createContext(NONE);

export const useStaffNotifications = () => useContext(StaffNotificationsContext);

// Holds a signed-in staff member's (department staff, chairperson, institutional staff)
// notifications for the whole app, so the rail badge and the Notifications page always agree and
// there is a single check running instead of one per screen. It checks every minute and when the
// tab comes back into view. For administrators, accreditors and when nobody is signed in it does
// nothing and makes no requests.
export function StaffNotificationsProvider({ children, pollMs = 60000 }) {
  const { user } = useAuth();
  const userId = NOTIFICATION_ROLES.includes(user?.role) ? user.id : null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Bumped whenever the signed-in user changes or the provider goes away, so a slow response for
  // someone who has since signed out is ignored instead of being shown to the next person.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = generation.current;
    try {
      const { data } = await getStaffNotifications();
      if (mine !== generation.current) return;
      setUnreadCount(data.unreadCount || 0);
      setNotifications(data.notifications || []);
      setFailed(false);
    } catch {
      if (mine !== generation.current) return;
      setFailed(true);
    } finally {
      if (mine === generation.current) {
        setLoaded(true);
        setNow(Date.now());
      }
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    setUnreadCount(0);
    setNotifications([]);
    setLoaded(false);
    setFailed(false);
    if (!userId) return undefined;

    load();
    const timer = setInterval(load, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      generation.current += 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, load, pollMs]);

  // Both show the change straight away, then reload if the server could not record it.
  const markRead = useCallback((id) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    markStaffNotificationRead(id).catch(load);
  }, [notifications, load]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    markAllStaffNotificationsRead().catch(load);
  }, [load]);

  const value = useMemo(() => ({
    unreadCount, notifications, loaded, failed, now, markRead, markAllRead, refresh: load,
  }), [unreadCount, notifications, loaded, failed, now, markRead, markAllRead, load]);

  return (
    <StaffNotificationsContext.Provider value={value}>
      {children}
    </StaffNotificationsContext.Provider>
  );
}
