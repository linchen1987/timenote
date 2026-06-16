import { VaultTagsPage } from '@timenote/ui';
import { useVaultStore } from '../lib/vault-store';

export function TagsPage() {
  return <VaultTagsPage useStore={useVaultStore} />;
}
