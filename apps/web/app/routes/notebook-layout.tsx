'use client';

import { NotebookLayout, useNotebookLayout } from '@timenote/ui';
import { useCallback } from 'react';
import { usePWA } from '~/hooks/use-pwa';
import { useVaultStore } from '~/lib/vault-store';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'TimeNote' }];
};

export default function NotebookLayoutPage() {
  const isPWA = usePWA();
  const { menuItems, vaultName, notebooks, menuActions } = useNotebookLayout(useVaultStore);

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
      notebooks={notebooks}
      menuItems={menuItems}
      menuActions={menuActions}
    />
  );
}
