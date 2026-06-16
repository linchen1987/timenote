import { STORAGE_KEYS } from '@timenote/core';
import { NotebooksPage } from '@timenote/ui';
import { useEffect } from 'react';
import { useVaultStore } from '../lib/vault-store';

export function NotebooksList() {
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN);
  }, []);

  return <NotebooksPage useVaultStore={useVaultStore} />;
}
