import { STORAGE_KEYS } from '@timenote/core';
import { NotebookLayout } from '@timenote/ui';
import { useCallback } from 'react';

export function NotebookLayoutWrapper() {
  const saveLastNotebook = useCallback((token: string) => {
    localStorage.setItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN, token);
  }, []);

  return <NotebookLayout isPWA={false} onSaveLastNotebook={saveLastNotebook} />;
}
