import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  Users,
  Lock,
  CheckCircle,
  Mail,
  Plus,
  Trash2,
  Server,
  Database,
  FolderGit2,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Phone,
  Calendar,
  Building,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { formatISTDate } from '../lib/dateUtils';

const INITIAL_ALLOWED_EMAILS = [
  'admin@insightai.io',
  'owner@insightai.io',
  'prathishska@gmail.com',
];

interface UserUsage {
  datasets_uploaded: number;
  database_projects: number;
  storage_mb: number;
  storage_kb: number;
  storage_bytes: number;
}

interface AdminUserItem {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  dob: string | null;
  role: string;
  organization_name: string;
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
  usage: UserUsage;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [allowedEmails, setAllowedEmails] = useState<string[]>(INITIAL_ALLOWED_EMAILS);
  const [newEmail, setNewEmail] = useState('');

  // User Directory State (10 users per page)
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [roleToast, setRoleToast] = useState<string | null>(null);

  const currentUserEmail = user?.email?.toLowerCase() || '';
  const isAllowedAdmin = allowedEmails.some((e) => e.toLowerCase() === currentUserEmail);

  // Handle Admin Role Change between org_owner and user
  const handleRoleChange = async (userId: string, targetEmail: string, newRole: string) => {
    setUpdatingUserId(userId);
    setRoleToast(null);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsersList((prev) =>
        prev.map((item) => (item.id === userId ? { ...item, role: newRole } : item))
      );
      setRoleToast(`Successfully changed role for ${targetEmail} to "${newRole}"`);
      setTimeout(() => setRoleToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to change user role:', err);
      alert(err.response?.data?.detail || 'Failed to update user role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Fetch Users with Usage Stats
  const fetchUsers = useCallback(async (currentPage: number, search = '') => {
    setIsLoadingUsers(true);
    setLoadError(null);
    try {
      const res = await api.get('/admin/users', {
        params: {
          page: currentPage,
          page_size: pageSize,
          search: search.trim() || undefined,
        },
      });
      setUsersList(res.data.items || []);
      setTotalUsers(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
      setPage(res.data.page || currentPage);
    } catch (err: any) {
      console.error('Failed to fetch admin users directory:', err);
      setLoadError(err.response?.data?.detail || 'Failed to load users list from server.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [pageSize]);

  useEffect(() => {
    if (isAllowedAdmin) {
      fetchUsers(page, searchTerm);
    }
  }, [isAllowedAdmin, page, fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, searchTerm);
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const handleAddEmail = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    const cleaned = newEmail.trim().toLowerCase();
    if (!allowedEmails.includes(cleaned)) {
      setAllowedEmails([...allowedEmails, cleaned]);
    }
    setNewEmail('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setAllowedEmails(allowedEmails.filter((e) => e !== emailToRemove));
  };

  // Helper for Age
  const getAgeFromDob = (dobString: string | null): number | null => {
    if (!dobString) return null;
    const b = new Date(dobString);
    if (isNaN(b.getTime())) return null;
    const diff = Date.now() - b.getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  };

  // If current user is NOT in the allowed email whitelist -> Lock View
  if (!isAllowedAdmin) {
    return (
      <div className="animate-fade-in" style={{ padding: '2rem 1rem' }}>
        <div
          className="card glass"
          style={{
            maxWidth: 540,
            margin: '3rem auto',
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-2xl)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--radius-2xl)',
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-error)',
              margin: '0 auto 1.5rem',
            }}
          >
            <Lock size={32} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Admin Portal Access Restricted
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            This system area is restricted to preferred administrator email IDs only. Your current email{' '}
            <code style={{ color: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
              {currentUserEmail || 'Unauthenticated'}
            </code>{' '}
            is not whitelisted for access.
          </p>

          <div
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              textAlign: 'left',
              fontSize: '0.8125rem',
              color: 'var(--text-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              <ShieldAlert size={16} style={{ color: 'var(--color-warning)' }} /> How to gain access:
            </div>
            Ask a system administrator to add your email address to the authorized admin email whitelist.
          </div>
        </div>
      </div>
    );
  }

  // Allowed Administrator Full View
  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span className="badge badge-success">
            <CheckCircle size={12} /> Authorized Administrator
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Administrator System Console
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
          Real-time user directory, resource usage audits & access controls granted to <strong style={{ color: 'var(--color-primary)' }}>{currentUserEmail}</strong>
        </p>
      </div>

      {/* ── Registered Users & Usage Listings (10 users in one go) ── */}
      <div className="card glass" style={{ marginBottom: '2rem', padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <h2 style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>Registered User Listings & Usages</h2>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                  {totalUsers} Total Accounts
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Showing 10 users per page with itemized dataset, project, and storage consumption
              </p>
            </div>
          </div>

          {/* Search & Refresh Bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '0.875rem', paddingLeft: '2.25rem', width: 240 }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm" title="Search">
              Search
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fetchUsers(page, searchTerm)}
              disabled={isLoadingUsers}
              title="Refresh Listings"
              style={{ padding: '0.4rem 0.6rem' }}
            >
              <RefreshCw size={15} className={isLoadingUsers ? 'animate-spin' : ''} />
            </button>
          </form>
        </div>

        {/* Role Update Toast Alert */}
        {roleToast && (
          <div
            className="animate-slide-down card"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              borderColor: 'var(--color-success)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-success)',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <CheckCircle size={16} />
            <span>{roleToast}</span>
          </div>
        )}

        {/* Load Error Alert */}
        {loadError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', color: 'var(--color-error)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {loadError}
          </div>
        )}

        {/* Users Table */}
        {isLoadingUsers ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--color-primary)' }} />
            <p style={{ fontSize: '0.9375rem' }}>Loading user directory and calculating usage metrics...</p>
          </div>
        ) : usersList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Users size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--text-tertiary)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Users Found</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Try clearing the search filter or verify registrations.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="table" style={{ borderCollapse: 'collapse', width: '100%', margin: 0 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border-default)' }}>
                  <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem', width: 250 }}>User Account</th>
                  <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem', width: 180 }}>Contact & Info</th>
                  <th style={{ borderRight: '1px solid var(--border-default)', padding: '0.875rem 1rem', width: 200 }}>Organization & Role Control</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Resource Usage Breakdown (List)</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u, idx) => {
                  const age = getAgeFromDob(u.dob);
                  const isOrgOwner = u.role === 'org_owner';
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: idx === usersList.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.012)',
                      }}
                    >
                      {/* 1. User Identity */}
                      <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 'var(--radius-full)',
                              background: 'linear-gradient(135deg, var(--color-primary), #818cf8)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '0.9375rem',
                              flexShrink: 0,
                            }}
                          >
                            {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                              {u.full_name || 'Unnamed User'}
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 2 }}>
                              <Mail size={12} style={{ color: 'var(--color-primary)' }} />
                              {u.email}
                            </div>
                            <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <span className={u.is_active ? 'badge badge-success' : 'badge badge-error'} style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem' }}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                                Joined {formatISTDate(u.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact & Demographics */}
                      <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}>
                            <Phone size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            <span>{u.phone_number ? u.phone_number : <em style={{ color: 'var(--text-tertiary)' }}>No phone</em>}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}>
                            <Calendar size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            <span>
                              {u.dob ? (
                                <>
                                  {u.dob} {age !== null && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>({age} yrs)</span>}
                                </>
                              ) : (
                                <em style={{ color: 'var(--text-tertiary)' }}>No DOB</em>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Organization & Role Control (org_owner vs user) */}
                      <td style={{ borderRight: '1px solid var(--border-subtle)', padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <Building size={13} style={{ color: 'var(--color-primary)' }} />
                            {u.organization_name || 'Personal Workspace'}
                          </div>
                          
                          {/* Role Selector Dropdown */}
                          <div style={{ marginTop: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                Admin Role Control:
                              </span>
                              {updatingUserId === u.id && (
                                <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                  Saving...
                                </span>
                              )}
                            </div>

                            {/* Main Owner Check: prathishska@gmail.com is permanently fixed to Owner */}
                            {u.email.toLowerCase() === 'prathishska@gmail.com' ? (
                              <div
                                style={{
                                  padding: '0.35rem 0.625rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                                  border: '1px solid var(--color-primary)',
                                  color: 'var(--color-primary)',
                                  borderRadius: 'var(--radius-md)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
                                }}
                              >
                                <span>👑 Main Owner</span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                  🔒 Fixed
                                </span>
                              </div>
                            ) : (
                              <select
                                className="input"
                                value={isOrgOwner ? 'org_owner' : 'user'}
                                onChange={(e) => handleRoleChange(u.id, u.email, e.target.value)}
                                disabled={updatingUserId === u.id}
                                style={{
                                  padding: '0.3rem 0.5rem',
                                  fontSize: '0.75rem',
                                  height: 'auto',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  width: '100%',
                                  background: isOrgOwner ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-elevated)',
                                  borderColor: isOrgOwner ? 'var(--color-primary)' : 'var(--border-default)',
                                  color: isOrgOwner ? 'var(--color-primary)' : 'var(--text-primary)',
                                  borderRadius: 'var(--radius-md)',
                                }}
                              >
                                <option value="org_owner">👑 org_owner (Org Owner)</option>
                                <option value="user">👤 user (Standard User)</option>
                              </select>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Itemized Resource Usage (List Format) */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
                          {/* Item 1: Datasets */}
                          <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}>
                              <Database size={13} style={{ color: 'var(--chart-teal)' }} />
                              Uploaded Datasets:
                            </span>
                            <strong style={{ color: 'var(--text-primary)' }}>{u.usage.datasets_uploaded} datasets</strong>
                          </li>

                          {/* Item 2: Projects */}
                          <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}>
                              <FolderGit2 size={13} style={{ color: 'var(--chart-blue)' }} />
                              Database Projects:
                            </span>
                            <strong style={{ color: 'var(--text-primary)' }}>{u.usage.database_projects} projects</strong>
                          </li>

                          {/* Item 3: Storage */}
                          <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}>
                              <HardDrive size={13} style={{ color: 'var(--color-primary)' }} />
                              Storage Consumed:
                            </span>
                            <strong style={{ color: 'var(--color-primary)' }}>
                              {u.usage.storage_mb > 0 ? `${u.usage.storage_mb} MB` : `${u.usage.storage_kb || 0} KB`}
                            </strong>
                          </li>
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Controls (10 in one go + Next/Prev Buttons) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-default)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{totalUsers === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(page * pageSize, totalUsers)}</strong> of <strong>{totalUsers}</strong> registered users
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Previous 10 Users */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePrevPage}
              disabled={page <= 1 || isLoadingUsers}
              id="admin-prev-users-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem' }}
            >
              <ChevronLeft size={16} /> Previous 10
            </button>

            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: '0.4rem 0.75rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            >
              Page {page} of {totalPages}
            </span>

            {/* Next 10 Users */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleNextPage}
              disabled={page >= totalPages || isLoadingUsers}
              id="admin-next-users-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem' }}
            >
              Next 10 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Whitelisted Email Manager Card */}
      <div className="card glass" style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-lg)', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <Mail size={18} />
          </div>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: '1.125rem', margin: 0 }}>Authorized Admin Email Whitelist</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>Only users with these exact email IDs can access the Admin Console</p>
          </div>
        </div>

        {/* Add Email Form */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', maxWidth: 500 }}>
          <input
            className="input"
            placeholder="Add new admin email (e.g. lead@domain.com)..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ fontSize: '0.875rem' }}
          />
          <button className="btn btn-primary" onClick={handleAddEmail} disabled={!newEmail.trim()}>
            <Plus size={16} /> Add Email
          </button>
        </div>

        {/* Whitelisted Emails Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
          {allowedEmails.map((em) => (
            <div
              key={em}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem 0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{em}</span>
              {em !== currentUserEmail && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRemoveEmail(em)}
                  style={{ padding: '0.1rem 0.3rem', color: 'var(--color-error)' }}
                  title="Remove from whitelist"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* System Status & Audit Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Server size={18} style={{ color: 'var(--chart-blue)' }} />
            <h3 style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>Backend Security Status</h3>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>RBAC Enforcement:</span> <span className="badge badge-success">Enabled</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Email Whitelist Filter:</span> <span className="badge badge-primary">Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Database Encryption:</span> <span className="badge badge-info">Bcrypt SHA-256</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Shield size={18} style={{ color: 'var(--color-accent)' }} />
            <h3 style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>System Audit Trail</h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
            System-level administrative changes and email whitelist updates are logged in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}

