import { toast } from 'sonner';
import { create } from 'zustand';
import { FsService } from '~/lib/services/fs-service';
import { SyncService } from '~/lib/services/sync/service';

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

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  notebookId: null,
  setSyncing: (isSyncing, notebookId) => set({ isSyncing, notebookId: notebookId || null }),
  syncPush: async (
    notebookId: string,
    options = { showToast: false, skipPull: false },
    onSyncComplete?: () => Promise<void>,
  ) => {
    if (!FsService.isConfigured()) return;

    const { isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, notebookId });
    try {
      if (options.skipPull) {
        await SyncService.push(notebookId);
        if (options.showToast) {
          toast.success('Pushed successfully');
        }
      } else {
        const hasPulledInSession = get().getHasPulledInSession(notebookId);
        if (!hasPulledInSession) {
          await SyncService.syncNotebook(notebookId);
          await onSyncComplete?.();
          sessionStorage.setItem(`timenote:pull:${notebookId}`, 'true');
          if (options.showToast) {
            toast.success('Synced successfully');
          }
        } else {
          await SyncService.push(notebookId);
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
    if (!FsService.isConfigured()) return;

    const { isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, notebookId });
    try {
      await SyncService.pull(notebookId);
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
        await SyncService.pull(notebookId);
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
