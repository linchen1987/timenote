'use client';

import { parseNotebookId } from '@timenote/core';
import { NotebookLayout } from '@timenote/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { usePWA } from '~/hooks/use-pwa';
import { useVaultStore } from '~/lib/vault-store';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'TimeNote' }];
};

export default function NotebookLayoutPage() {
  const isPWA = usePWA();
  const { notebookToken } = useParams();
  const projectId = parseNotebookId(notebookToken || '');

  const menuItems = useVaultStore((state) => state.menuItems);
  const vaults = useVaultStore((state) => state.vaults);
  const [vaultName, setVaultName] = useState<string | undefined>();

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const init = async () => {
      await useVaultStore.getState().init();
      await useVaultStore.getState().activateVault(projectId);
      if (cancelled) return;
      const v = useVaultStore.getState().vaults.find((v) => v.projectId === projectId);
      setVaultName(v?.name);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const menuActions = useMemo(
    () => ({
      reorder: (updates: { id: string; order: number; parentId: string | null }[]) =>
        useVaultStore.getState().reorderMenuItems(projectId, updates),
      add: (item: {
        parentId: string | null;
        title: string;
        type: 'note' | 'search';
        search?: string;
      }) => useVaultStore.getState().addMenuItem(projectId, item),
      update: (id: string, updates: { title: string; type: 'note' | 'search'; search?: string }) =>
        useVaultStore.getState().updateMenuItem(projectId, id, updates),
      delete: (id: string) => useVaultStore.getState().deleteMenuItem(projectId, id),
    }),
    [projectId],
  );

  const manifestEffect = useCallback((notebookToken: string) => {
    let link = document.querySelector(`link[rel="manifest"]`) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = `/s/${notebookToken}/manifest.webmanifest`;

    return () => {
      link?.remove();
    };
  }, []);

  return (
    <NotebookLayout
      isPWA={isPWA}
      extraEffects={manifestEffect}
      notebookName={vaultName}
      notebooks={vaults.map((v) => ({ id: v.projectId, name: v.name }))}
      menuItems={menuItems}
      menuActions={menuActions}
    />
  );
}
