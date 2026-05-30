import { parseNotebookId, type RuntimeMenuItem } from '@timenote/core';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import type { VaultStore } from '../../stores/vault-store';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface UseNotebookLayoutReturn {
  menuItems: RuntimeMenuItem[];
  vaultName: string | undefined;
  notebooks: { id: string; name: string }[];
  menuActions: {
    reorder: (updates: { id: string; order: number; parentId: string | null }[]) => Promise<void>;
    add: (item: {
      parentId: string | null;
      title: string;
      type: 'note' | 'search';
      search?: string;
    }) => Promise<void>;
    update: (
      id: string,
      updates: { title: string; type: 'note' | 'search'; search?: string },
    ) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
}

export function useNotebookLayout(useStore: UseVaultStoreHook): UseNotebookLayoutReturn {
  const { notebookToken } = useParams();
  const projectId = parseNotebookId(notebookToken || '');

  const menuItems = useStore((state) => state.menuItems);
  const vaults = useStore((state) => state.vaults);
  const [vaultName, setVaultName] = useState<string | undefined>();

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const init = async () => {
      await useStore.getState().init();
      await useStore.getState().activateVault(projectId);
      if (cancelled) return;
      const v = useStore.getState().vaults.find((v) => v.projectId === projectId);
      setVaultName(v?.name);
      useStore.getState().tryEntrySync(projectId);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId, useStore.getState]);

  const menuActions = useMemo(
    () => ({
      reorder: (updates: { id: string; order: number; parentId: string | null }[]) =>
        useStore.getState().reorderMenuItems(projectId, updates),
      add: (item: {
        parentId: string | null;
        title: string;
        type: 'note' | 'search';
        search?: string;
      }) => useStore.getState().addMenuItem(projectId, item),
      update: (id: string, updates: { title: string; type: 'note' | 'search'; search?: string }) =>
        useStore.getState().updateMenuItem(projectId, id, updates),
      delete: (id: string) => useStore.getState().deleteMenuItem(projectId, id),
    }),
    [projectId, useStore.getState],
  );

  const notebooks = vaults.map((v) => ({ id: v.projectId, name: v.name }));

  return { menuItems, vaultName, notebooks, menuActions };
}
