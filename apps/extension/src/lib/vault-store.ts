import {
  createOpfsVaultRegistry,
  createTransportFromConfig,
  VaultOrchestrator,
} from '@timenote/core';
import { createBoundVaultStore } from '@timenote/ui';

export type { VaultMeta } from '@timenote/core';

const orchestrator = new VaultOrchestrator(createTransportFromConfig, createOpfsVaultRegistry);
export const useVaultStore = createBoundVaultStore(orchestrator);
