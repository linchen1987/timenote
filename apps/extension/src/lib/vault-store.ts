import { createOpfsVaultRegistry, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';

export type { VaultMeta } from '@timenote/core';

const orchestrator = new VaultOrchestrator(
  createOpfsVaultRegistry,
  createLocalStorageProviderStore(),
);
export const useVaultStore = createBoundVaultStore(orchestrator);
