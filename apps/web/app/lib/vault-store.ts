import { createOpfsVaultRegistry, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';
import { createRpcClient } from './web-transport';

const orchestrator = new VaultOrchestrator(
  createOpfsVaultRegistry,
  createLocalStorageProviderStore(),
  createRpcClient,
);
export const useVaultStore = createBoundVaultStore(orchestrator);
