import { STORAGE_KEYS } from '@timenote/core';
import { NotebookLayout, useNotebookLayout } from '@timenote/ui';
import { useCallback } from 'react';
import { useVaultStore } from '../lib/vault-store';

export function NotebookLayoutWrapper() {
  const { menuItems, vaultName, notebooks, menuActions } = useNotebookLayout(useVaultStore);

  const saveLastNotebook = useCallback((token: string) => {
    localStorage.setItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN, token);
  }, []);

  return (
    <NotebookLayout
      isPWA={false}
      onSaveLastNotebook={saveLastNotebook}
      notebookName={vaultName}
      notebooks={notebooks}
      menuItems={menuItems}
      menuActions={menuActions}
    />
  );
}
