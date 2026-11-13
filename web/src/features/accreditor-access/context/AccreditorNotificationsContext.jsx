import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ROLES } from '../../../shared/constants/roles';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../api';

// What anything outside the provider (staff screens) sees: no notifications, nothing to do.
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

const AccreditorNotificationsContext = createContext(NONE);

export const useAccreditorNotifications = () => useContext(AccreditorNotificationsContext);

// Holds a signed-in accreditor's notifications for the whole app, so the sidebar badge and the
// Notifications page always agree (marking one read updates both at once) and there is a single
// check running instead of one per screen. It checks every minute and when the tab comes back
// into view, because expiry warnings appear as time passes, not because anyone did anything.
// For staff accounts, and when nobody is signed in, it does nothing and makes no requests.
export function AccreditorNotificationsProvider({ children, pollMs = 60000 }) {
  const { user } = useAuth();
  const accreditorId = user?.role === ROLES.ACCREDITOR_LINK ? user.id : null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Bumped whenever the signed-in accreditor changes or the provider goes away, so a slow response
  // for someone who has since signed out is ignored instead of being shown to the next person.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = generation.current;
    try {
      const { data } = await getMyNotifications();
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
    if (!accreditorId) return undefined;

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
  }, [accreditorId, load, pollMs]);

  // Both show the change straight away, then reload if the server could not record it.
  const markRead = useCallback((id) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    markNotificationRead(id).catch(load);
  }, [notifications, load]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(load);
  }, [load]);

  const value = useMemo(() => ({
    unreadCount, notifications, loaded, failed, now, markRead, markAllRead, refresh: load,
  }), [unreadCount, notifications, loaded, failed, now, markRead, markAllRead, load]);

  return (
    <AccreditorNotificationsContext.Provider value={value}>
      {children}
    </AccreditorNotificationsContext.Provider>
  );
}
