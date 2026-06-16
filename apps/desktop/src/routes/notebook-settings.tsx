import { NotebookSettingsPage } from '@timenote/ui';
import { useParams } from 'react-router';
import { useVaultStore } from '../lib/vault-store';

export function NotebookSettings() {
  const { notebookToken } = useParams();
  return <NotebookSettingsPage useVaultStore={useVaultStore} notebookToken={notebookToken!} />;
}
