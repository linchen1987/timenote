import { STORAGE_KEYS } from '@timenote/core';
import { create } from 'zustand';

interface SidebarState {
  isDesktopSidebarOpen: boolean;
  isMobileSidebarOpen: boolean;
  toggleDesktopSidebar: () => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isDesktopSidebarOpen: true,
  isMobileSidebarOpen: false,
  toggleDesktopSidebar: () =>
    set((state) => {
      const newState = !state.isDesktopSidebarOpen;
      localStorage.setItem(STORAGE_KEYS.DESKTOP_SIDEBAR_OPEN, String(newState));
      return { isDesktopSidebarOpen: newState };
    }),
  setDesktopSidebarOpen: (open: boolean) =>
    set(() => {
      localStorage.setItem(STORAGE_KEYS.DESKTOP_SIDEBAR_OPEN, String(open));
      return { isDesktopSidebarOpen: open };
    }),
  toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
  setMobileSidebarOpen: (open: boolean) => set({ isMobileSidebarOpen: open }),
}));
