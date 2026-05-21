import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { UseVaultStoreHook } from './use-notebooks-page';

export interface UseExportVaultReturn {
  isExporting: boolean;
  handleExport: () => Promise<void>;
}

export function useExportVault(
  useStore: UseVaultStoreHook,
  projectId: string | null,
  successMessage?: string,
): UseExportVaultReturn {
  const [isExporting, setIsExporting] = useState(false);
  const { exportVault } = useStore();

  const handleExport = useCallback(async () => {
    if (!projectId) return;
    setIsExporting(true);
    try {
      await exportVault(projectId);
      toast.success(successMessage ?? 'Vault exported');
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  }, [projectId, exportVault, successMessage]);

  return { isExporting, handleExport };
}
