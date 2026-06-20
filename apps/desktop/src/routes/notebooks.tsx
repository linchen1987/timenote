import { open } from '@tauri-apps/plugin-dialog';
import { STORAGE_KEYS } from '@timenote/core';
import { NotebooksPage } from '@timenote/ui';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CreateVaultDialog } from '../lib/create-vault-dialog';
import { closeCurrentWindow, openNotebookWindow } from '../lib/notebook-window';
import { pickAndRegisterVault } from '../lib/open-vault';
import { getDesktopRegistry, useVaultStore } from '../lib/vault-store';

export function NotebooksList() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    localStorage.removeItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN);
  }, []);

  const handleCreateVault = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleDialogChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) setRefreshKey((k) => k + 1);
  }, []);

  const handleOpenNotebook = useCallback(async (token: string, name: string) => {
    try {
      await openNotebookWindow(token, name);
      await closeCurrentWindow();
    } catch (e) {
      const msg = typeof e === 'string' ? e : ((e as Error)?.message ?? String(e));
      toast.error(`打开失败: ${msg}`);
    }
  }, []);

  const handleOpenVault = useCallback(async () => {
    try {
      const registry = await getDesktopRegistry();
      const entry = await pickAndRegisterVault(registry);
      if (entry) {
        toast.success(`已打开: ${entry.name}`);
        setRefreshKey((k) => k + 1);
      }
    } catch (e) {
      const msg = typeof e === 'string' ? e : ((e as Error)?.message ?? String(e));
      toast.error(`打开失败: ${msg}`);
    }
  }, []);

  const handlePickCloneDir = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择 Clone 目标目录',
    });
    if (!selected || typeof selected !== 'string') return null;
    return selected;
  }, []);

  return (
    <>
      <NotebooksPage
        key={refreshKey}
        useVaultStore={useVaultStore}
        onCreateVault={handleCreateVault}
        onOpenVault={handleOpenVault}
        onOpenNotebook={handleOpenNotebook}
        onPickCloneDir={handlePickCloneDir}
      />
      <CreateVaultDialog open={createDialogOpen} onOpenChange={handleDialogChange} />
    </>
  );
}
