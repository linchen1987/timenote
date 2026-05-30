import { createOpfsVaultStorage, createVaultStore } from '@timenote/core';
import { createRemoteTransport } from './web-transport';

export const useVaultStore = createVaultStore(createRemoteTransport, createOpfsVaultStorage);
