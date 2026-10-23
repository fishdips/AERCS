import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api';
import './LoginPage.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.error || 'Something went wrong. Please try again.');
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
          <h1 className="login-heading">Forgot Password</h1>
          <hr className="login-divider" />

          {sent ? (
            <>
              <p className="login-success-note">
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
                Check your inbox (and spam folder).
              </p>
              <Link className="login-btn login-btn-link" to="/login">Back to Sign In</Link>
            </>
          ) : (
            <>
              <p className="login-subheading">
                Enter your account email and we'll send you a link to reset your password.
              </p>

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

                <button type="submit" className="login-btn" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Reset Link'}
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
