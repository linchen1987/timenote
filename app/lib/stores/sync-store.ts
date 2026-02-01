import { toast } from 'sonner';
import { create } from 'zustand';
import { SyncService } from '~/lib/services/sync/service';
import { WebDAVService } from '~/lib/services/webdav-service';

interface SyncState {
  isSyncing: boolean;
  notebookId: string | null;
  setSyncing: (isSyncing: boolean, notebookId?: string) => void;
  syncPush: (notebookId: string, showToast?: boolean) => Promise<void>;
  sync: (
    notebookId: string,
    onSyncComplete?: () => Promise<void>,
    forcePull?: boolean,
  ) => Promise<void>;
  getHasPulledInSession: (notebookId: string) => boolean;
  ensurePulled: (notebookId: string) => Promise<boolean>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  notebookId: null,
  setSyncing: (isSyncing, notebookId) => set({ isSyncing, notebookId: notebookId || null }),
  syncPush: async (notebookId: string, showToast = false) => {
    if (!WebDAVService.isConfigured()) return;

    const { isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, notebookId });
    try {
      await SyncService.push(notebookId);
      if (showToast) {
        toast.success('Pushed successfully');
      }
    } catch (e) {
      console.error('Push error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      toast.error(`Push failed: ${errorMessage}`);
    } finally {
      set({ isSyncing: false, notebookId: null });
    }
  },
  sync: async (notebookId: string, onSyncComplete?: () => Promise<void>, forcePull = false) => {
    if (!WebDAVService.isConfigured()) return;

    const { isSyncing } = get();
    if (isSyncing) return;

    const hasPulledInSession = get().getHasPulledInSession(notebookId);

    set({ isSyncing: true, notebookId });
    try {
      if (forcePull || !hasPulledInSession) {
        await SyncService.syncNotebook(notebookId);
        await onSyncComplete?.();
        sessionStorage.setItem(`timenote:pull:${notebookId}`, 'true');
        toast.success('Synced successfully');
      } else {
        await SyncService.push(notebookId);
        toast.success('Pushed successfully');
      }
    } catch (e) {
      console.error('Sync error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      toast.error(`Sync failed: ${errorMessage}`);
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
