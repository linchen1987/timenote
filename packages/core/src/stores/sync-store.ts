import { create } from 'zustand';
import type { FsService } from '../fs/fs-service';
import type { SyncServiceInstance } from '../services/sync-service';

export interface ToastAdapter {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface SyncState {
  isSyncing: boolean;
  notebookId: string | null;
  setSyncing: (isSyncing: boolean, notebookId?: string) => void;
  syncPush: (
    notebookId: string,
    options?: { showToast?: boolean; skipPull?: boolean },
    onSyncComplete?: () => Promise<void>,
  ) => Promise<void>;
  syncPull: (notebookId: string, onSyncComplete?: () => Promise<void>) => Promise<void>;
  getHasPulledInSession: (notebookId: string) => boolean;
  ensurePulled: (notebookId: string) => Promise<boolean>;
}

export function createSyncStore(
  fsService: FsService,
  syncService: SyncServiceInstance,
  toast: ToastAdapter,
) {
  return create<SyncState>((set, get) => ({
    isSyncing: false,
    notebookId: null,
    setSyncing: (isSyncing, notebookId) => set({ isSyncing, notebookId: notebookId || null }),
    syncPush: async (
      notebookId: string,
      options = { showToast: false, skipPull: false },
      onSyncComplete?: () => Promise<void>,
    ) => {
      if (!fsService.isConfigured()) return;

      const { isSyncing } = get();
      if (isSyncing) return;

      set({ isSyncing: true, notebookId });
      try {
        if (options.skipPull) {
          await syncService.push(notebookId);
          if (options.showToast) {
            toast.success('Pushed successfully');
          }
        } else {
          const hasPulledInSession = get().getHasPulledInSession(notebookId);
          if (!hasPulledInSession) {
            await syncService.syncNotebook(notebookId);
            await onSyncComplete?.();
            sessionStorage.setItem(`timenote:pull:${notebookId}`, 'true');
            if (options.showToast) {
              toast.success('Synced successfully');
            }
          } else {
            await syncService.push(notebookId);
            if (options.showToast) {
              toast.success('Pushed successfully');
            }
          }
        }
      } catch (e) {
        console.error('Sync error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
        toast.error(`Sync failed: ${errorMessage}`);
      } finally {
        set({ isSyncing: false, notebookId: null });
      }
    },
    syncPull: async (notebookId: string, onSyncComplete?: () => Promise<void>) => {
      if (!fsService.isConfigured()) return;

      const { isSyncing } = get();
      if (isSyncing) return;

      set({ isSyncing: true, notebookId });
      try {
        await syncService.pull(notebookId);
        await onSyncComplete?.();
        sessionStorage.setItem(`timenote:pull:${notebookId}`, 'true');
        toast.success('Pulled successfully');
      } catch (e) {
        console.error('Pull error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
        toast.error(`Pull failed: ${errorMessage}`);
      } finally {
        set({ isSyncing: false, notebookId: null });
      }
    },
    getHasPulledInSession: (notebookId: string) => {
      return sessionStorage.getItem(`timenote:pull:${notebookId}`) === 'true';
    },
    ensurePulled: async (notebookId: string) => {
      const hasPulled = get().getHasPulledInSession(notebookId);

      if (!hasPulled) {
        try {
          await syncService.pull(notebookId);
          sessionStorage.setItem(`timenote:pull:${notebookId}`, 'true');
          toast.success('Data pulled successfully');
          return true;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
          console.error('Auto pull error:', e);
          toast.error(`Auto pull failed: ${errorMessage}`);
          return false;
        }
      }
      return true;
    },
  }));
}

export type SyncStore = ReturnType<typeof createSyncStore>;
