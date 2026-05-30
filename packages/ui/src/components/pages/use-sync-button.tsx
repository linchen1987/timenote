import type { VaultStore } from '@timenote/core';
import { getEnabledRemotes } from '@timenote/core';
import { ArrowUpDown, Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface UseSyncButtonReturn {
  hasRemote: boolean;
  isSyncing: boolean;
  syncSuccess: boolean;
  handleSync: () => Promise<void>;
  syncIcon: ReactNode;
  syncTitle: string;
}

export function useSyncButton(
  useStore: UseVaultStoreHook,
  projectId: string | undefined,
  onSuccess?: () => Promise<void>,
): UseSyncButtonReturn {
  const isSyncing = useStore((s) => s.isSyncing);
  const syncSuccess = useStore((s) => s.syncSuccess);
  const lastSyncError = useStore((s) => s.lastSyncError);
  const noteVersion = useStore((s) => s.noteVersion);

  const [hasRemote, setHasRemote] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setHasRemote(false);
      return;
    }
    const remotes = getEnabledRemotes(projectId);
    setHasRemote(Object.keys(remotes).length > 0);
  }, [projectId, noteVersion]);

  useEffect(() => {
    if (!lastSyncError) return;
    toast.error(`Sync failed: ${lastSyncError}`);
    const timer = setTimeout(() => useStore.setState({ lastSyncError: null }), 3000);
    return () => clearTimeout(timer);
  }, [lastSyncError, useStore]);

  useEffect(() => {
    if (!syncSuccess) return;
    const timer = setTimeout(() => useStore.setState({ syncSuccess: false }), 1500);
    return () => clearTimeout(timer);
  }, [syncSuccess, useStore]);

  const handleSync = useCallback(async () => {
    if (!projectId) return;
    if (isSyncing) return;
    try {
      const result = await useStore.getState().sync(projectId);
      if (
        result &&
        typeof result === 'object' &&
        'errors' in result &&
        (result as any).errors?.length > 0
      ) {
        // errors shown via lastSyncError toast
      }
      await onSuccess?.();
    } catch {
      // lastSyncError is set in store, toast shown by useEffect
    }
  }, [projectId, isSyncing, useStore, onSuccess]);

  const syncIcon = isSyncing ? (
    <Loader2 className="w-4 h-4 animate-spin text-primary" />
  ) : syncSuccess ? (
    <Check className="w-4 h-4 text-green-500 animate-sync-pop" />
  ) : (
    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
  );

  return {
    hasRemote,
    isSyncing,
    syncSuccess,
    handleSync,
    syncIcon,
    syncTitle: isSyncing ? 'Syncing...' : 'Sync',
  };
}
