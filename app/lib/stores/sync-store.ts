import { toast } from 'sonner';
import { create } from 'zustand';
import { SyncService } from '~/lib/services/sync/service';
import { WebDAVService } from '~/lib/services/webdav-service';

interface SyncState {
  isSyncing: boolean;
  notebookId: string | null;
  setSyncing: (isSyncing: boolean, notebookId?: string) => void;
  syncPush: (notebookId: string, showToast?: boolean) => Promise<void>;
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
}));
