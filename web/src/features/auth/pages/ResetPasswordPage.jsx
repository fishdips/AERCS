import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../api';
import './LoginPage.css';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'This reset link is invalid or has expired.');
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
          <h1 className="login-heading">Reset Password</h1>
          <hr className="login-divider" />

          {done ? (
            <>
              <p className="login-success-note">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button className="login-btn" type="button" onClick={() => navigate('/login')}>
                Go to Sign In
              </button>
            </>
          ) : (
            <>
              <p className="login-subheading">Choose a new password for your account.</p>

              {error && (
                <>
                  <p className="login-error">{error}</p>
                  {error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired') ? (
                    <p className="login-external-note" style={{ marginTop: 0 }}>
                      <Link to="/forgot-password">Request a new reset link</Link>
                    </p>
                  ) : null}
                </>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="login-field">
                  <label className="login-label" htmlFor="newPassword">New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    className="login-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="login-field">
                  <label className="login-label" htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="login-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" className="login-btn" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Set New Password'}
                </button>
              </form>

              <p className="login-external-note">
                <Link to="/login">Back to Sign In</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
