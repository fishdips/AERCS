import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ROLE_LABELS, ROLES } from '../../../shared/constants/roles';
import '../pages/ActivityManagementPage.css';

export default function ActivityShell({ children }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;
  const isAccreditor = user?.role === ROLES.ACCREDITOR_LINK;
  const navClass = ({ isActive }) => `am-nav-link ${isActive ? 'am-nav-active' : ''}`;
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="am-shell">
      <header className="am-header">
        <div className="am-header-left">
          <div className="am-logo-box">A</div>
          <div className="am-logo-text">
            <span className="am-logo-name">AERCS</span>
            <span className="am-logo-sub">EVIDENCE REPOSITORY</span>
          </div>
        </div>
        <div className="am-header-right">
          <span className="am-badge">AY 2026-2027</span>
          <div className="am-avatar">{user?.name?.charAt(0) ?? 'A'}</div>
          <div className="am-user-info">
            <span className="am-user-name">{user?.name}</span>
            <span className="am-user-role">{ROLE_LABELS[user?.role] ?? user?.role}</span>
          </div>
        </div>
      </header>

      <div className="am-body">
        <aside className="am-sidebar">
          <nav className="am-nav">
            {isAccreditor ? (
              <>
                <p className="am-nav-section">Accreditation Review</p>
                <NavLink to="/accreditor" className={navClass}>Evidence Links</NavLink>
              </>
            ) : (
              <>
                <p className="am-nav-section">Workspace</p>
                <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
                <NavLink to="/activities" className={navClass}>Documentation</NavLink>
                <NavLink to="/repository" className={navClass}>Repository</NavLink>
                <NavLink to="/shared-evidence" className={navClass}>Shared Evidence</NavLink>
              </>
            )}
            {isAdmin && (
              <>
                <p className="am-nav-section">Administration</p>
                <NavLink to="/admin/users" className={navClass}>Access Management</NavLink>
              </>
            )}
          </nav>
          <div className="am-sidebar-footer">
            <div className="am-signed-as">
              <span className="am-signed-label">Signed in as</span>
              <span className="am-signed-name">{user?.name}</span>
            </div>
            <button className="am-logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </aside>

        <main className="am-main">
          <div className="am-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
