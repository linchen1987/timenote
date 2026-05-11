import { listProviders, type ProviderConfig, type VaultMeta } from '@timenote/core';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { UseVaultStoreHook } from './use-notebooks-page';

export interface UseProviderScannerReturn {
  providers: ProviderConfig[];
  scanResults: Map<string, VaultMeta[]>;
  remoteOnlyVaults: VaultMeta[];
  scanningId: string | null;
  isPulling: string | null;
  showManualPull: boolean;
  manualProviderId: string;
  manualPath: string;
  handleScan: (providerId: string) => Promise<void>;
  handlePull: (projectId: string) => Promise<void>;
  handleManualPull: () => Promise<void>;
  setShowManualPull: (v: boolean) => void;
  setManualProviderId: (v: string) => void;
  setManualPath: (v: string) => void;
  refresh: () => void;
}

export function useProviderScanner(
  useStore: UseVaultStoreHook,
  localVaults: VaultMeta[],
): UseProviderScannerReturn {
  const [providers, setProviders] = useState<ProviderConfig[]>(() => listProviders());
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Map<string, VaultMeta[]>>(new Map());
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [showManualPull, setShowManualPull] = useState(false);
  const [manualProviderId, setManualProviderId] = useState('');
  const [manualPath, setManualPath] = useState('');

  const localIds = new Set(localVaults.map((v) => v.projectId));
  const allRemoteVaults = Array.from(scanResults.values()).flat();
  const remoteOnlyVaults = allRemoteVaults.filter((v) => !localIds.has(v.projectId));

  const refresh = useCallback(() => {
    setProviders(listProviders());
  }, []);

  const handleScan = useCallback(
    async (providerId: string) => {
      setScanningId(providerId);
      try {
        const result = await useStore.getState().listRemoteVaults(providerId);
        setScanResults((prev) => {
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
    async (projectId: string) => {
      setIsPulling(projectId);
      try {
        await useStore.getState().cloneVault(projectId);
        toast.success('Vault pulled from remote');
      } catch (e) {
        toast.error(`Pull failed: ${(e as Error).message}`);
      } finally {
        setIsPulling(null);
      }
    },
    [useStore],
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
    } catch (e) {
      toast.error(`Pull failed: ${(e as Error).message}`);
    } finally {
      setIsPulling(null);
    }
  }, [useStore, manualProviderId, manualPath]);

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
    refresh,
  };
}
