import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
            Signed in as {user?.name}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.45rem 1rem',
            background: '#111', color: '#fff', border: 'none',
            fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Dashboard — coming soon</p>
    </div>
  );
}
