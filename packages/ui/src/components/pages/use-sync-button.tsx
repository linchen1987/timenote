import type { VaultStore } from '@timenote/core';
import { ArrowUpDown, Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface UseSyncButtonReturn {
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

  useEffect(() => {
    if (!syncSuccess) return;
    const timer = setTimeout(() => useStore.setState({ syncSuccess: false }), 1500);
    return () => clearTimeout(timer);
  }, [syncSuccess, useStore]);

  const handleSync = useCallback(async () => {
    if (!projectId || isSyncing) return;
    try {
      const result = await useStore.getState().sync(projectId);
      if (result.errors.length > 0) {
        toast.error(`Sync errors: ${result.errors.join('; ')}`);
      }
      await onSuccess?.();
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
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
    isSyncing,
    syncSuccess,
    handleSync,
    syncIcon,
    syncTitle: isSyncing ? 'Syncing...' : 'Sync',
  };
}
