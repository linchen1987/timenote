'use client';

import { VaultNoteDetailPage } from '@timenote/ui';
import { useVaultStore } from '~/lib/vault-store';

export default function VaultNoteDetailPageWrapper() {
  return <VaultNoteDetailPage useStore={useVaultStore} />;
}
