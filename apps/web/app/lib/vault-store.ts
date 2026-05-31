import { createOpfsVaultRegistry, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';
import { createRemoteProvider } from './web-transport';

const orchestrator = new VaultOrchestrator(
  createOpfsVaultRegistry,
  createLocalStorageProviderStore(),
  createRemoteProvider,
);
export const useVaultStore = createBoundVaultStore(orchestrator);
