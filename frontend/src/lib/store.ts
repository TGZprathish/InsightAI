import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTab: 'overview',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
