import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ROLES } from '../../../shared/constants/roles';
import './LoginPage.css';

export default function LoginPage() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.mustChangePw) navigate('/change-password', { replace: true });
    else if (user.role === ROLES.ADMIN) navigate('/admin/users', { replace: true });
    else navigate('/activities', { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await login(email, password);
      setUser(data);
      if (data.mustChangePw) navigate('/change-password');
      else if (data.role === ROLES.ADMIN) navigate('/admin/users');
      else navigate('/activities');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-logo">
          <div className="login-logo-box">A</div>
          <div className="login-logo-text">
            <span className="login-logo-name">AERCS</span>
            <span className="login-logo-sub">EVIDENCE REPOSITORY</span>
          </div>
        </div>

        <div className="login-brand-center">
          <img src="/cit_logo.png" alt="CIT-U Logo" className="login-crest-img" />
          <p className="login-system-name">
            Accreditation Evidence Repository &amp; Coordination System
          </p>
        </div>

        <p className="login-footer">© INSTITUTION — OFFICE OF QUALITY ASSURANCE</p>
      </div>

      <div className="login-right">
        <div className="login-form-card">
          <h1 className="login-heading">Sign In</h1>
          <hr className="login-divider" />

          {error && <p className="login-error">{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="login-input"
                placeholder="firstname.lastname@inst.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" /> Remember device
              </label>
              <button type="button" className="login-forgot" tabIndex={-1} disabled>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          <p className="login-external-note">
            External accreditors use the temporary access link.
          </p>
        </div>
      </div>
    </div>
  );
}
