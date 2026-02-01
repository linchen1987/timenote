import { create } from 'zustand';
import { STORAGE_KEYS } from '~/lib/constants';

interface SidebarState {
  isDesktopSidebarOpen: boolean;
  isMobileSidebarOpen: boolean;
  toggleDesktopSidebar: () => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

const getInitialDesktopState = () => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEYS.DESKTOP_SIDEBAR_OPEN) !== 'false';
};

export const useSidebarStore = create<SidebarState>((set) => ({
  isDesktopSidebarOpen: getInitialDesktopState(),
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
