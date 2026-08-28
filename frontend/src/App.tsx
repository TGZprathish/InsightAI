import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './lib/auth';
import { useEffect } from 'react';

import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectsPage from './pages/ProjectsPage';
import DatasetsPage from './pages/DatasetsPage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import ReportsPage from './pages/ReportsPage';
import AIChatPage from './pages/AIChatPage';
import AdminPage from './pages/AdminPage';
import UsagePage from './pages/UsagePage';
import ProfilePage from './pages/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const ADMIN_EMAILS = ['admin@insightai.io', 'owner@insightai.io', 'prathishska@gmail.com'];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const isAdmin = Boolean(user && (user.role === 'admin' || ADMIN_EMAILS.includes(user.email?.toLowerCase())));
  if (!isAdmin) return <Navigate to="/projects" replace />;
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  const { isAuthenticated, fetchUser } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  }, []);

  return (
    <Routes>
      {/* Root Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Auth routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/projects" /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/projects" /> : <RegisterPage />} />

      {/* Protected Workspaces */}
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/datasets" element={<ProtectedRoute><DatasetsPage /></ProtectedRoute>} />
      <Route path="/dashboards" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/analyses" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/usage" element={<ProtectedRoute><UsagePage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* Default fallback to Landing Page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
