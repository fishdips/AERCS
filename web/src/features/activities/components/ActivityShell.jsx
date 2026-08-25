import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ROLE_LABELS, ROLES } from '../../../shared/constants/roles';
import '../pages/ActivityManagementPage.css';

export default function ActivityShell({ children }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
        <div className="am-header-search">
          <input className="am-search-global" placeholder="Search activities, evidence, offices..." readOnly />
        </div>
        <div className="am-header-right">
          <span className="am-badge">AY 2025-2026</span>
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
            <p className="am-nav-section">Workspace</p>
            <span className="am-nav-link am-nav-disabled">Dashboard</span>
            <NavLink to="/activities" className={({ isActive }) => `am-nav-link ${isActive ? 'am-nav-active' : ''}`}>Documentation</NavLink>
            <NavLink to="/repository" className={({ isActive }) => `am-nav-link ${isActive ? 'am-nav-active' : ''}`}>Repository</NavLink>
            <NavLink to="/shared-evidence" className={({ isActive }) => `am-nav-link ${isActive ? 'am-nav-active' : ''}`}>Shared Evidence</NavLink>
            <span className="am-nav-link am-nav-disabled">Monitoring</span>
            {isAdmin && (
              <>
                <p className="am-nav-section">Administration</p>
                <NavLink to="/admin/users" className={({ isActive }) => `am-nav-link ${isActive ? 'am-nav-active' : ''}`}>Access Management</NavLink>
                <span className="am-nav-link am-nav-disabled">Audit Logs</span>
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
