import { createVaultStore, type VaultMeta } from '@timenote/core/vault';
import { extensionTransport } from './extension-transport';

export type { VaultMeta };

export const useVaultStore = createVaultStore(extensionTransport);
