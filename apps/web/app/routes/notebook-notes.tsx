'use client';

import { VaultTimelinePage } from '@timenote/ui';
import { useVaultStore } from '~/lib/vault-store';

export default function VaultTimelinePageWrapper() {
  return (
    <VaultTimelinePage
      useStore={useVaultStore}
      headerMaxWidth="360px"
      linkExtraProps={{ suppressHydrationWarning: true }}
    />
  );
}
