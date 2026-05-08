import { VaultTimelinePage } from '@timenote/ui';
import { useVaultStore } from '../../lib/vault-store';

export function NotebookTimelinePage() {
  return <VaultTimelinePage useStore={useVaultStore} headerMaxWidth="280px" />;
}
