import { createBrowserVaultRegistry, registerDriver, VaultOrchestrator } from '@timenote/core';
import { LocalFsDriver } from '@timenote/core/fs/adapters/localfs/opfs';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';

export type { VaultMeta } from '@timenote/core';

registerDriver('localfs', LocalFsDriver);

const orchestrator = new VaultOrchestrator(
  createBrowserVaultRegistry,
  createLocalStorageProviderStore(),
);
export const useVaultStore = createBoundVaultStore(orchestrator);
