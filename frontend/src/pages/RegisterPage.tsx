import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Sparkles, ArrowRight, Building2 } from 'lucide-react';

const EXACT_ORGANIZATION_OPTIONS = [
  'Data Analyist',
  'student',
  'Company Owner',
  'Educator',
  'Finance',
  'Consultant',
  'Researcher',
  'Other',
];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [customOrgName, setCustomOrgName] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedOrg) {
      setError('Please select your organization role / type before creating an account.');
      return;
    }

    const finalOrgName = selectedOrg === 'Other' ? customOrgName.trim() : selectedOrg;

    if (selectedOrg === 'Other' && !finalOrgName) {
      setError('Please specify your organization name.');
      return;
    }

    try {
      await register(email, password, fullName, finalOrgName);
      navigate('/projects');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || err.message || 'Registration failed';
      setError(msg);
    }
  };

  return (
    <div className="bg-mesh" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: 440, borderRadius: 'var(--radius-2xl)', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: 'var(--shadow-glow-primary)' }}>
            <Sparkles size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}><span className="gradient-text">Create Account</span></h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Start analyzing your data with AI</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Full Name</label>
            <input
              className="input"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              id="register-name"
            />
          </div>

          {/* Organization Options Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              <Building2 size={14} /> Organization Role / Type <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select
              className="input"
              value={selectedOrg}
              onChange={(e) => {
                setSelectedOrg(e.target.value);
                if (error) setError('');
              }}
              required
              id="register-org-select"
              style={{ cursor: 'pointer', color: selectedOrg ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              <option value="" disabled hidden>
                -- Select Organization / Role --
              </option>
              {EXACT_ORGANIZATION_OPTIONS.map((org) => (
                <option key={org} value={org} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  {org}
                </option>
              ))}
            </select>
          </div>

          {/* Custom text input if 'Other' selected */}
          {selectedOrg === 'Other' && (
            <div style={{ marginBottom: '1rem', animation: 'fadeIn 0.3s ease-out' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Specify Organization Name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Custom Organization Name"
                value={customOrgName}
                onChange={(e) => setCustomOrgName(e.target.value)}
                required
                id="register-custom-org"
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              id="register-email"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              id="register-password"
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: 'var(--color-error)', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg glow-primary" style={{ width: '100%' }} disabled={isLoading} id="register-submit">
            {isLoading ? 'Creating...' : 'Create Account'}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
