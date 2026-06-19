import { NotebookLogsPage } from '@timenote/ui';
import { useParams } from 'react-router';
import { useVaultStore } from '../../lib/vault-store';

export function NotebookLogs() {
  const { notebookToken } = useParams();
  return <NotebookLogsPage useVaultStore={useVaultStore} notebookToken={notebookToken!} />;
}
