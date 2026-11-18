import { useEffect, useRef, useState } from 'react';
import { Archive, Bell, FileText, HelpCircle, LayoutDashboard, Link2, LogOut, Share2, Users, ChevronDown } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { NOTIFICATION_ROLES, ROLE_LABELS, ROLES } from '../../../shared/constants/roles';
import { HELP_ROLES } from '../constants';
import { useAccreditorNotifications } from '../../accreditor-access/context/AccreditorNotificationsContext';
import { useStaffNotifications } from '../../notifications/context/StaffNotificationsContext';
import Icon from '../../../shared/components/Icon';
import '../pages/ActivityManagementPage.css';

export default function ActivityShell({ children }) {
  const { user, logout } = useAuth();
  const canAccessAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.ACCRED_COORDINATOR;
  const isAccreditor = user?.role === ROLES.ACCREDITOR_LINK;
  // Everyone except accreditors gets the Help Center.
  const canSeeHelp = HELP_ROLES.includes(user?.role);
  const navClass = ({ isActive }) => `am-nav-link ${isActive ? 'am-nav-active' : ''}`;
  // In the rail only the icon shows; the label stays in the DOM for screen readers and as a tooltip.
  const item = (icon, label) => (
    <>
      <Icon as={icon} size={18} />
      <span className="am-nav-label">{label}</span>
    </>
  );
  const navigate = useNavigate();
  const { unreadCount } = useAccreditorNotifications();
  // Staff with a department or office get their own Notifications tab (administrators have none).
  const hasStaffNotifications = NOTIFICATION_ROLES.includes(user?.role);
  const { unreadCount: staffUnreadCount } = useStaffNotifications();
  // /accreditor/notifications sits under /accreditor, so Evidence Links must not claim it as well.
  const onNotifications = (useLocation()?.pathname || '').startsWith('/accreditor/notifications');

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="am-shell">
      <header className="am-header">
        <div className="am-header-left">
          <img className="am-logo-img" src="/aercs_logo.png" alt="" />
          <div className="am-logo-text">
            <span className="am-logo-name">AERCS</span>
          </div>
        </div>
        <div className="am-header-right">
          <span className="am-badge">AY 2026-2027</span>
          <div className="am-profile" ref={menuRef}>
            <button
              type="button"
              className="am-profile-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="am-avatar">{user?.name?.charAt(0) ?? 'A'}</div>
              <div className="am-user-info">
                <span className="am-user-name">{user?.name}</span>
                <span className="am-user-role">{ROLE_LABELS[user?.role] ?? user?.role}</span>
              </div>
              <Icon as={ChevronDown} size={14} />
            </button>
            {menuOpen && (
              <div className="am-profile-menu" role="menu">
                <button type="button" role="menuitem" className="am-profile-menu-item" onClick={handleLogout}>
                  <Icon as={LogOut} size={15} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="am-body">
        <aside className="am-sidebar">
          {/* The panel floats over the page: the aside keeps the 64px rail footprint so content never shifts. */}
          <div className="am-sidebar-panel">
          <nav className="am-nav">
            {isAccreditor ? (
              <>
                <p className="am-nav-section">Accreditation Review</p>
                <NavLink to="/accreditor/notifications" title="Notifications" className={(state) => `${navClass(state)} am-nav-link-badge`}>
                  {item(Bell, 'Notifications')}
                  {unreadCount > 0 && (
                    <span className="am-nav-badge" aria-label={`${unreadCount} unread`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
                <NavLink to="/accreditor" title="Evidence Links" className={({ isActive }) => navClass({ isActive: isActive && !onNotifications })}>
                  {item(Link2, 'Evidence Links')}
                </NavLink>
              </>
            ) : (
              <>
                <p className="am-nav-section">Workspace</p>
                {hasStaffNotifications && (
                  <NavLink to="/notifications" title="Notifications" className={(state) => `${navClass(state)} am-nav-link-badge`}>
                    {item(Bell, 'Notifications')}
                    {staffUnreadCount > 0 && (
                      <span className="am-nav-badge" aria-label={`${staffUnreadCount} unread`}>
                        {staffUnreadCount > 99 ? '99+' : staffUnreadCount}
                      </span>
                    )}
                  </NavLink>
                )}
                <NavLink to="/dashboard" title="Dashboard" className={navClass}>{item(LayoutDashboard, 'Dashboard')}</NavLink>
                <NavLink to="/activities" title="Documentation" className={navClass}>{item(FileText, 'Documentation')}</NavLink>
                <NavLink to="/repository" title="Repository" className={navClass}>{item(Archive, 'Repository')}</NavLink>
                <NavLink to="/shared-evidence" title="Shared Evidence" className={navClass}>{item(Share2, 'Shared Evidence')}</NavLink>
              </>
            )}
            {canAccessAdmin && (
              <>
                <p className="am-nav-section">Administration</p>
                <NavLink to="/admin/users" title="Access Management" className={navClass}>{item(Users, 'Access Management')}</NavLink>
              </>
            )}
            {canSeeHelp && (
              <>
                <p className="am-nav-section">Support</p>
                <NavLink to="/help" title="Help" className={navClass}>{item(HelpCircle, 'Help')}</NavLink>
              </>
            )}
          </nav>
          </div>
        </aside>

        <main className="am-main">
          <div className="am-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
