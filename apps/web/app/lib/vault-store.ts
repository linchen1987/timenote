import { createOpfsVaultRegistry, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore } from '@timenote/ui';
import { createRemoteTransport } from './web-transport';

const orchestrator = new VaultOrchestrator(createRemoteTransport, createOpfsVaultRegistry);
export const useVaultStore = createBoundVaultStore(orchestrator);
