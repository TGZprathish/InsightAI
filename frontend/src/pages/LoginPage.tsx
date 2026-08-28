import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import {
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Mail,
  Lock,
  ShieldCheck,
} from 'lucide-react';

type AuthMode = 'login' | 'forgot_request' | 'forgot_reset' | 'reset_success';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Forgot password form state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotNotice, setForgotNotice] = useState('');

  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  // Handle standard login
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      await login(email, password);
      navigate('/projects');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        err.message ||
        'Invalid email or password';
      setLoginError(msg);
    }
  };

  // Step 1: Request reset token for email
  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotNotice('');
    setIsSubmitting(true);

    try {
      const res = await api.post('/auth/forgot-password', {
        email: resetEmail.trim(),
      });

      if (res.data.reset_token) {
        setResetToken(res.data.reset_token);
      }
      setForgotNotice(res.data.message || 'Reset token generated successfully.');
      setMode('forgot_reset');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to request password reset. Please try again.';
      setForgotError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Submit new password with reset token
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('New passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/auth/reset-password', {
        token: resetToken.trim(),
        new_password: newPassword,
      });

      setMode('reset_success');
      setEmail(resetEmail); // pre-populate email for login
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to reset password. The token may be expired.';
      setForgotError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bg-mesh"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 'var(--radius-2xl)',
          padding: '2.5rem',
          boxSizing: 'border-box',
        }}
      >
        {/* ─── Mode: Normal Login ───────────────────────────── */}
        {mode === 'login' && (
          <>
            {/* Logo & Heading */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-xl)',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  boxShadow: 'var(--shadow-glow-primary)',
                }}
              >
                <Sparkles size={28} color="white" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                <span className="gradient-text">InsightAI</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Sign in to your analytical workspace
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.375rem',
                  }}
                >
                  Email Address
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  id="login-email"
                />
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setForgotError('');
                      setForgotNotice('');
                      setMode('forgot_request');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    id="forgot-password-link"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    id="login-password"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-error)',
                    marginTop: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={isLoading}
                id="login-submit"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                {!isLoading && <ArrowRight size={18} />}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>
                Create one
              </Link>
            </p>
          </>
        )}

        {/* ─── Mode: Forgot Password - Step 1 (Request Token) ─── */}
        {mode === 'forgot_request' && (
          <div className="animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(20, 184, 166, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.875rem',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(20, 184, 166, 0.25)',
                }}
              >
                <KeyRound size={26} />
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Reset Your Password
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.375rem', lineHeight: 1.5 }}>
                Enter your account email address to receive a secure password reset token.
              </p>
            </div>

            <form onSubmit={handleRequestReset}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.375rem',
                  }}
                >
                  Registered Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@company.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    id="forgot-email-input"
                    style={{ paddingLeft: '2.5rem' }}
                    autoFocus
                  />
                  <Mail
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '0.875rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-tertiary)',
                    }}
                  />
                </div>
              </div>

              {forgotError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-error)',
                    marginBottom: '1rem',
                  }}
                >
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginBottom: '0.75rem' }}
                disabled={isSubmitting}
                id="send-reset-token-btn"
              >
                {isSubmitting ? 'Verifying Account...' : 'Continue to Reset Password'}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setMode('login')}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </form>
          </div>
        )}

        {/* ─── Mode: Forgot Password - Step 2 (Enter New Password) */}
        {mode === 'forgot_reset' && (
          <div className="animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(59, 130, 246, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.875rem',
                  color: 'var(--color-info)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}
              >
                <Lock size={26} />
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Set New Password
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.375rem' }}>
                Create a new secure password for <b style={{ color: 'var(--text-primary)' }}>{resetEmail}</b>
              </p>
            </div>

            {forgotNotice && (
              <div
                style={{
                  background: 'var(--color-primary-subtle)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.625rem 0.875rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-primary)',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                <span>Verification token loaded and validated for your account.</span>
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.375rem',
                  }}
                >
                  Reset Security Token
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Paste reset token"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                  id="reset-token-input"
                  style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.375rem',
                  }}
                >
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    id="new-password-input"
                    style={{ paddingRight: '2.5rem' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.375rem',
                  }}
                >
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    id="confirm-password-input"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {forgotError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-error)',
                    marginBottom: '1rem',
                  }}
                >
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginBottom: '0.75rem' }}
                disabled={isSubmitting}
                id="reset-password-submit-btn"
              >
                {isSubmitting ? 'Updating Password...' : 'Save New Password'}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setMode('forgot_request')}
              >
                <ArrowLeft size={16} /> Back
              </button>
            </form>
          </div>
        )}

        {/* ─── Mode: Reset Success ───────────────────────────── */}
        {mode === 'reset_success' && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                color: 'var(--color-success)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Password Updated!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              Your password has been reset successfully. You can now sign in with your new password.
            </p>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={() => {
                setPassword('');
                setLoginError('');
                setMode('login');
              }}
              id="proceed-to-login-btn"
            >
              Proceed to Sign In <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

