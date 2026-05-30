import { createOpfsVaultStorage, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore } from '@timenote/ui';
import { createRemoteTransport } from './web-transport';

const orchestrator = new VaultOrchestrator(createRemoteTransport, createOpfsVaultStorage);
export const useVaultStore = createBoundVaultStore(orchestrator);
