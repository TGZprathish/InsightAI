import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useUI } from '../../lib/store';
import {
  LayoutDashboard, Database, BarChart3, Brain, FileText,
  MessageSquare, Settings, Users, ChevronLeft, ChevronRight,
  LogOut, Sparkles, Activity, Menu, X, ShieldAlert, WifiOff, Clock,
} from 'lucide-react';
import { formatISTTime, formatISTDate } from '../../lib/dateUtils';

const navItems = [
  { to: '/projects', label: 'Projects', icon: LayoutDashboard },
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3 },
  { to: '/analyses', label: 'Analysis', icon: Activity },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/chat', label: 'AI Chat', icon: MessageSquare },
  { to: '/admin', label: 'Admin', icon: Users },
  { to: '/usage', label: 'Usage', icon: Settings },
];

const ADMIN_EMAILS = ['admin@insightai.io', 'owner@insightai.io', 'prathishska@gmail.com'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { sidebarOpen, toggleSidebar } = useUI();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentIST, setCurrentIST] = useState(() => formatISTTime(new Date(), { showSeconds: false, showTimezone: false }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIST(formatISTTime(new Date(), { showSeconds: false, showTimezone: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = Boolean(user && (user.role === 'admin' || ADMIN_EMAILS.includes(user.email?.toLowerCase())));
  const visibleNavItems = navItems.filter((item) => item.to !== '/admin' || isAdmin);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirm(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{
          width: sidebarOpen ? 260 : 72,
          transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          overflowX: 'hidden',
        }}
      >
        {/* Logo — Interactive Home Page Link */}
        <NavLink
          to="/"
          style={{
            padding: '1.25rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, opacity 0.15s ease',
          }}
          title="Return to Home / Landing Page"
          id="insightai-logo-home-link"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-primary), #818cf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
          >
            <Sparkles size={20} />
          </div>
          {sidebarOpen && (
            <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
              Insight<span style={{ color: 'var(--color-primary)' }}>AI</span>
            </span>
          )}
        </NavLink>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`
              }
              style={{
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                padding: sidebarOpen ? '0.625rem 0.875rem' : '0.625rem',
                width: '100%',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                gap: '0.75rem',
              }}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User & Collapse */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0.75rem' }}>
          {sidebarOpen && user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              {/* Clickable Profile Card */}
              <NavLink
                to="/profile"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  flex: 1,
                  minWidth: 0,
                  textDecoration: 'none',
                  color: 'inherit',
                  background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                })}
                title="View and Edit Profile"
                id="sidebar-profile-link"
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.full_name || user.email}
                  </div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      marginTop: '0.1rem',
                    }}
                    title={`Organization: ${user.organization_name || 'Personal Workspace'}`}
                  >
                    🏢 {user.organization_name || 'Personal Workspace'}
                  </div>
                </div>
              </NavLink>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="btn btn-ghost btn-sm"
                title="Logout"
                id="sidebar-logout-btn"
                style={{ color: 'var(--text-secondary)', padding: '0.4rem', flexShrink: 0 }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : !sidebarOpen && user ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <NavLink
                to="/profile"
                className="btn btn-ghost btn-sm"
                title={`Profile: ${user.full_name || user.email}`}
                id="sidebar-collapsed-profile-btn"
                style={{
                  width: 36,
                  height: 36,
                  padding: 0,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                }}
              >
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </NavLink>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="btn btn-ghost btn-sm"
                title={`Logout (${user.email})`}
                id="sidebar-collapsed-logout-btn"
                style={{ width: 36, height: 36, padding: 0, borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : null}

          {/* Live Indian Standard Time Display */}
          {sidebarOpen ? (
            <div
              style={{
                padding: '0.35rem 0.625rem',
                marginBottom: '0.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.6875rem',
              }}
              title="Indian Standard Time (Asia/Kolkata, UTC+5:30)"
              id="ist-live-time-indicator"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                <Clock size={12} style={{ color: 'var(--color-primary)' }} />
                <span>{currentIST}</span>
              </div>
              <span style={{ fontSize: '0.625rem', color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.02em' }}>
                IST (UTC+5:30)
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '0.5rem',
                color: 'var(--color-primary)',
              }}
              title={`Indian Standard Time: ${currentIST} IST`}
            >
              <Clock size={14} />
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: sidebarOpen ? 'flex-end' : 'center' }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="bg-mesh"
        style={{
          flex: 1,
          marginLeft: sidebarOpen ? 260 : 72,
          transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '1.5rem',
          minHeight: '100vh',
          minWidth: 0,
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {!isOnline && (
          <div
            className="animate-slide-down"
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: 'var(--color-warning)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <WifiOff size={18} />
            <span>
              <strong>Offline Mode Active:</strong> You are currently disconnected. Changes are preserved in memory and will sync once connection is restored.
            </span>
          </div>
        )}
        {children}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: '2rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              animation: 'fadeSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    flexShrink: 0,
                  }}
                >
                  <LogOut size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                    Confirm Logout
                  </h3>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                    End your active session
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ padding: '0.25rem', borderRadius: 'var(--radius-md)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Are you sure you want to log out of <strong>InsightAI</strong>? You will need to sign in again to access your projects, datasets, and reports.
            </p>

            {user && (
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {user.full_name || 'User'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
                id="cancel-logout-btn"
              >
                Stay Logged In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmLogout}
                id="confirm-logout-btn"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  borderColor: '#ef4444',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
              >
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
