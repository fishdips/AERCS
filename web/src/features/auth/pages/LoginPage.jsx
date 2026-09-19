import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ROLES } from '../../../shared/constants/roles';
import './LoginPage.css';

export default function LoginPage() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      if (err.response) {
        setError(err.response.data?.error || 'Invalid email or password');
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
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
              <div className="login-password-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" /> Remember device
              </label>
              <Link className="login-forgot" to="/forgot-password">
                Forgot password?
              </Link>
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
