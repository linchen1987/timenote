import {
  createOpfsVaultStorage,
  createVaultStore,
  type TransportResolver,
  type VaultMeta,
} from '@timenote/core';
import { createExtensionTransport } from './extension-transport';

export type { VaultMeta };

const resolver: TransportResolver = {
  createTransport(provider) {
    return createExtensionTransport(provider);
  },
};

export const useVaultStore = createVaultStore(resolver, createOpfsVaultStorage);
