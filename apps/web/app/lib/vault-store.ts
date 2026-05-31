import { createOpfsVaultRegistry, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';
import { createRpcProvider } from './web-transport';

const orchestrator = new VaultOrchestrator(
  createOpfsVaultRegistry,
  createLocalStorageProviderStore(),
  createRpcProvider,
);
export const useVaultStore = createBoundVaultStore(orchestrator);
