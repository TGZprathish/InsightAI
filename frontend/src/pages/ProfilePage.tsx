import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Building,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Save,
  Lock,
  Eye,
  EyeOff,
  Phone,
  Calendar,
  Layers,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

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

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  // Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dob, setDob] = useState(user?.dob || '');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [customOrgName, setCustomOrgName] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Format incoming or stored phone number for India (+91)
  const parseIndianPhone = (raw: string | null | undefined): string => {
    if (!raw) return '';
    // Strip non-digits
    let digits = raw.replace(/\D/g, '');
    // If starts with 91 and has 12 digits, strip country code for input
    if (digits.startsWith('91') && digits.length > 10) {
      digits = digits.slice(2);
    }
    // Limit to 10 digits
    digits = digits.slice(0, 10);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return digits;
  };

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhoneNumber(parseIndianPhone(user.phone_number));
      setDob(user.dob || '');

      // Initialize organization select
      const currentOrg = user.organization_name || '';
      if (EXACT_ORGANIZATION_OPTIONS.includes(currentOrg)) {
        setSelectedOrg(currentOrg);
        setCustomOrgName('');
      } else if (currentOrg) {
        setSelectedOrg('Other');
        setCustomOrgName(currentOrg);
      } else {
        setSelectedOrg('Data Analyist');
        setCustomOrgName('');
      }
    }
  }, [user]);

  // Handle Indian phone input formatting
  const handlePhoneChange = (val: string) => {
    const rawDigits = val.replace(/\D/g, '').slice(0, 10);
    if (rawDigits.length > 5) {
      setPhoneNumber(`${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`);
    } else {
      setPhoneNumber(rawDigits);
    }
  };

  // Calculate age from DOB if present
  const calculateAge = (dobString: string): number | null => {
    if (!dobString) return null;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return null;
    const diffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const currentAge = calculateAge(dob);

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate phone number if provided (must be 10 digits for India)
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly && digitsOnly.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const finalFormattedPhone = digitsOnly ? `+91 ${digitsOnly.slice(0, 5)} ${digitsOnly.slice(5)}` : '';

    // Validate Organization
    const finalOrgName = selectedOrg === 'Other' ? customOrgName.trim() : selectedOrg;
    if (selectedOrg === 'Other' && !finalOrgName) {
      setErrorMsg('Please specify your organization name.');
      return;
    }

    // Validate password change if attempted
    if (newPassword) {
      if (!currentPassword) {
        setErrorMsg('Please enter your current password to set a new password.');
        return;
      }
      if (newPassword.length < 8) {
        setErrorMsg('New password must be at least 8 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New password and confirmation password do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: {
        full_name?: string;
        phone_number?: string;
        dob?: string;
        organization_name?: string;
        current_password?: string;
        new_password?: string;
      } = {
        full_name: fullName.trim(),
        phone_number: finalFormattedPhone || undefined,
        dob: dob,
        organization_name: finalOrgName || 'Personal Workspace',
      };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      await updateProfile(payload);

      setSuccessMsg('Profile details updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Failed to update profile. Please verify your current password and data.';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
          User Profile & Account Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Manage your personal information, workspace organization, and account credentials
        </p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div
          className="animate-slide-down card"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'rgba(16, 185, 129, 0.12)',
            borderColor: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-success)',
          }}
        >
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          className="animate-slide-down card"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-error)',
          }}
        >
          <AlertCircle size={20} />
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{errorMsg}</span>
        </div>
      )}

      {/* Top Profile Summary Card */}
      <div
        className="card"
        style={{
          padding: '1.75rem',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-elevated))',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--color-primary), #818cf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '2rem',
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
            flexShrink: 0,
          }}
        >
          {(fullName || user?.email || 'U').charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>
              {fullName || user?.email}
            </h2>
            <span
              className="badge badge-primary"
              style={{ textTransform: 'capitalize', fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              <Shield size={12} style={{ marginRight: 4 }} />
              {user?.role || 'Analyst'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              marginTop: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Mail size={15} style={{ color: 'var(--color-primary)' }} />
              {user?.email}
            </span>
            {user?.phone_number && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Phone size={15} style={{ color: 'var(--color-primary)' }} />
                {user.phone_number}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Building size={15} style={{ color: 'var(--color-primary)' }} />
              {user?.organization_name || 'Personal Workspace'}
            </span>
          </div>
        </div>

        {/* User ID Tag */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.625rem 0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Account UUID
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : 'N/A'}
            </code>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCopyId}
              style={{ padding: 4, height: 24, width: 24 }}
              title="Copy User ID"
            >
              {copiedId ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveProfile}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card 1: Personal & Workspace Information */}
          <div
            className="card"
            style={{
              padding: '1.75rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-primary-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                <UserIcon size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                  Personal & Workspace Information
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
                  Update how your name and organization appear across reports and dashboards
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Full Name */}
              <div>
                <label className="label" htmlFor="profile-full-name">
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-full-name"
                    type="text"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                  />
                  <UserIcon
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>

              {/* Email (Read-Only / Fixed) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="label" htmlFor="profile-email">
                    Email Address
                  </label>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    🔒 Fixed Security Identity
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-email"
                    type="email"
                    className="input"
                    value={user?.email || ''}
                    disabled
                    readOnly
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      background: 'var(--bg-elevated)',
                      cursor: 'not-allowed',
                      color: 'var(--text-secondary)',
                      opacity: 0.85,
                    }}
                  />
                  <Mail
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>

              {/* Mobile Number (India Format: +91) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="label" htmlFor="profile-phone">
                    Mobile Number (India)
                  </label>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                    10-digit mobile
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      id="profile-phone"
                      type="tel"
                      className="input"
                      value={phoneNumber}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="98765 43210"
                      maxLength={11}
                      style={{ width: '100%', paddingLeft: '2.5rem', letterSpacing: '0.04em', fontWeight: 500 }}
                    />
                    <Phone
                      size={16}
                      style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Date of Birth & Age */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="label" htmlFor="profile-dob">
                    Date of Birth (DOB)
                  </label>
                  {currentAge !== null && (
                    <span className="badge badge-primary" style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem' }}>
                      🎂 {currentAge} years old
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-dob"
                    type="date"
                    className="input"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                  />
                  <Calendar
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>

              {/* Organization Pull Down (Same as Signup / Register Page) */}
              <div>
                <label className="label" htmlFor="profile-org-select">
                  Organization Role / Type <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="profile-org-select"
                    className="input"
                    value={selectedOrg}
                    onChange={(e) => {
                      setSelectedOrg(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    required
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
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
                  <Building
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>

              {/* Custom Organization Text Input (if 'Other' selected) */}
              {selectedOrg === 'Other' && (
                <div className="animate-fade-in">
                  <label className="label" htmlFor="profile-custom-org">
                    Specify Organization Name <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="profile-custom-org"
                      type="text"
                      className="input"
                      value={customOrgName}
                      onChange={(e) => setCustomOrgName(e.target.value)}
                      placeholder="e.g. Acme Enterprise"
                      required
                      style={{ width: '100%', paddingLeft: '2.5rem' }}
                    />
                    <Building
                      size={16}
                      style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                    />
                  </div>
                </div>
              )}

              {/* Role (Read Only) */}
              <div>
                <label className="label" htmlFor="profile-role">
                  Account Role & Permissions
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-role"
                    type="text"
                    className="input"
                    value={user?.role ? `${user.role.toUpperCase()} (Assigned)` : 'Analyst'}
                    disabled
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      background: 'var(--bg-elevated)',
                      cursor: 'not-allowed',
                      color: 'var(--text-secondary)',
                    }}
                  />
                  <Shield
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Security & Password Management */}
          <div
            className="card"
            style={{
              padding: '1.75rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-warning)',
                }}
              >
                <KeyRound size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                  Security & Password Credentials
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
                  Leave password fields blank if you do not wish to change your password
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Current Password */}
              <div>
                <label className="label" htmlFor="profile-current-pw">
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-current-pw"
                    type={showCurrentPw ? 'text' : 'password'}
                    className="input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to change"
                    style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <Lock
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="label" htmlFor="profile-new-pw">
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-new-pw"
                    type={showNewPw ? 'text' : 'password'}
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <KeyRound
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
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
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="label" htmlFor="profile-confirm-pw">
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-confirm-pw"
                    type={showNewPw ? 'text' : 'password'}
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                  />
                  <Check
                    size={16}
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              alignItems: 'center',
              paddingTop: '0.5rem',
            }}
          >
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              id="save-profile-btn"
              style={{
                padding: '0.75rem 1.75rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Save size={18} />
              <span>{isSaving ? 'Saving Updates...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
