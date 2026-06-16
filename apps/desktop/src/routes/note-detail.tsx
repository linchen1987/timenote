import { VaultNoteDetailPage } from '@timenote/ui';
import { useVaultStore } from '../lib/vault-store';

export function NoteDetail() {
  return <VaultNoteDetailPage useStore={useVaultStore} />;
}
