import { NotebooksPage } from '@timenote/ui';
import { useVaultStore } from '../../lib/vault-store';

export function NotebooksList() {
  return <NotebooksPage useVaultStore={useVaultStore} />;
}
