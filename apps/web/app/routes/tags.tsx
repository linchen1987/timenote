'use client';

import { VaultTagsPage } from '@timenote/ui';
import { useVaultStore } from '~/lib/vault-store';

export default function TagsPage() {
  return <VaultTagsPage useStore={useVaultStore} prefetch="intent" />;
}
