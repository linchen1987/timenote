import {
  createOpfsVaultStorage,
  createTransportFromConfig,
  createVaultStore,
  type VaultMeta,
} from '@timenote/core';

export type { VaultMeta };

export const useVaultStore = createVaultStore(createTransportFromConfig, createOpfsVaultStorage);
