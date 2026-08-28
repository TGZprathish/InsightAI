import { create } from 'zustand';
import api from './api';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone_number?: string | null;
  dob?: string | null;
  role: string;
  organization_id: string;
  organization_name?: string | null;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, orgName: string) => Promise<void>;
  logout: () => void;
  clearUserData: () => void;
  purgeAccountData: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateProfile: (payload: {
    full_name?: string;
    phone_number?: string;
    dob?: string;
    organization_name?: string;
    current_password?: string;
    new_password?: string;
  }) => Promise<User>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email, password, fullName, orgName) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        full_name: fullName,
        organization_name: orgName,
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  clearUserData: () => {
    localStorage.clear();
    sessionStorage.clear();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  purgeAccountData: async () => {
    try {
      await api.delete('/auth/me/data');
    } catch {
      // Ignore API errors if server is unreachable
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  fetchUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  updateProfile: async (payload) => {
    const { data } = await api.patch('/auth/me', payload);
    set({ user: data });
    return data;
  },
}));
