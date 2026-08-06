import { VaultNoteMigrationPage } from '@timenote/ui';
import { useVaultStore } from '../lib/vault-store';

export function NotebookMigratePage() {
  return <VaultNoteMigrationPage useStore={useVaultStore} />;
}
