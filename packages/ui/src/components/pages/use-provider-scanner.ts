import { type FsProviderEntry, getDefaultRemotePath, type VaultMeta } from '@timenote/core';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { UseVaultStoreHook } from './use-notebooks-page';

export interface RemoteVaultMeta extends VaultMeta {
  providerId: string;
  path: string;
}

export interface UseProviderScannerReturn {
  providers: FsProviderEntry[];
  scanResults: Map<string, VaultMeta[]>;
  remoteOnlyVaults: RemoteVaultMeta[];
  scanningId: string | null;
  isPulling: string | null;
  showManualPull: boolean;
  manualProviderId: string;
  manualPath: string;
  handleScan: (providerId: string) => Promise<void>;
  handlePull: (providerId: string, path: string) => Promise<void>;
  handleManualPull: () => Promise<void>;
  setShowManualPull: (v: boolean) => void;
  setManualProviderId: (v: string) => void;
  setManualPath: (v: string) => void;
  refreshProviders: () => void;
}

export function useProviderScanner(
  useStore: UseVaultStoreHook,
  localVaults: VaultMeta[],
  onPullSuccess: () => Promise<void>,
): UseProviderScannerReturn {
  const [providers, setProviders] = useState<FsProviderEntry[]>(() =>
    useStore.getState().listProviders(),
  );
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Map<string, VaultMeta[]>>(new Map());
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [showManualPull, setShowManualPull] = useState(false);
  const [manualProviderId, setManualProviderId] = useState('');
  const [manualPath, setManualPath] = useState('');

  const localIds = new Set(localVaults.map((v) => v.projectId));
  const remoteOnlyVaults: RemoteVaultMeta[] = [];
  for (const [providerId, vaults] of scanResults) {
    for (const v of vaults) {
      if (!localIds.has(v.projectId)) {
        remoteOnlyVaults.push({
          ...v,
          providerId,
          path: getDefaultRemotePath(v.projectId),
        });
      }
    }
  }

  const refreshProviders = useCallback(() => {
    setProviders(useStore.getState().listProviders());
  }, [useStore.getState]);

  const handleScan = useCallback(
    async (providerId: string) => {
      setScanningId(providerId);
      try {
        const result = await useStore.getState().listRemoteVaults(providerId);
        setScanResults((prev: Map<string, VaultMeta[]>) => {
          const next = new Map(prev);
          next.set(providerId, result);
          return next;
        });
      } catch (e) {
        toast.error(`Scan failed: ${(e as Error).message}`);
      } finally {
        setScanningId(null);
      }
    },
    [useStore],
  );

  const handlePull = useCallback(
    async (providerId: string, path: string) => {
      setIsPulling(`${providerId}:${path}`);
      try {
        await useStore.getState().cloneFromProvider(providerId, path);
        toast.success('Vault pulled from remote');
        await onPullSuccess();
      } catch (e) {
        toast.error(`Pull failed: ${(e as Error).message}`);
      } finally {
        setIsPulling(null);
      }
    },
    [useStore, onPullSuccess],
  );

  const handleManualPull = useCallback(async () => {
    if (!manualProviderId || !manualPath) return;
    setIsPulling('manual');
    try {
      await useStore.getState().cloneFromProvider(manualProviderId, manualPath);
      toast.success('Vault pulled from remote');
      setShowManualPull(false);
      setManualProviderId('');
      setManualPath('');
      await onPullSuccess();
    } catch (e) {
      toast.error(`Pull failed: ${(e as Error).message}`);
    } finally {
      setIsPulling(null);
    }
  }, [useStore, manualProviderId, manualPath, onPullSuccess]);

  return {
    providers,
    scanResults,
    remoteOnlyVaults,
    scanningId,
    isPulling,
    showManualPull,
    manualProviderId,
    manualPath,
    handleScan,
    handlePull,
    handleManualPull,
    setShowManualPull,
    setManualProviderId,
    setManualPath,
    refreshProviders,
  };
}
