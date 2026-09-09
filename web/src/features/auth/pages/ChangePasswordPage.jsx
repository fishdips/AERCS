import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ROLES } from '../../../shared/constants/roles';
import './ChangePasswordPage.css';

export default function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await changePassword(currentPassword, newPassword);
      setUser({ ...user, mustChangePw: false });
      if (user.role === ROLES.ADMIN) navigate('/admin/users');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cp-page">
      <div className="cp-left">
        <div className="cp-logo">
          <div className="cp-logo-box">A</div>
          <div className="cp-logo-text">
            <span className="cp-logo-name">AERCS</span>
            <span className="cp-logo-sub">EVIDENCE REPOSITORY</span>
          </div>
        </div>

        <div className="cp-brand-center">
          <img src="/cit_logo.png" alt="CIT-U Logo" className="cp-crest-img" />
          <p className="cp-system-name">
            Accreditation Evidence Repository &amp; Coordination System
          </p>
        </div>

        <p className="cp-footer">© INSTITUTION — OFFICE OF QUALITY ASSURANCE</p>
      </div>

      <div className="cp-right">
        <div className="cp-form-card">
          <h1 className="cp-heading">Change Password</h1>
          <p className="cp-subheading">
            You must set a new password before continuing.
          </p>
          <hr className="cp-divider" />

          {error && <p className="cp-error">{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="cp-field">
              <label className="cp-label" htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                className="cp-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="cp-field">
              <label className="cp-label" htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                className="cp-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <span className="cp-hint">Minimum 8 characters</span>
            </div>

            <div className="cp-field">
              <label className="cp-label" htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                className="cp-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="cp-btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
