import { createVaultStore, type TransportResolver } from '@timenote/core';
import { createTransportForProvider } from './web-transport';

const resolver: TransportResolver = {
  createTransport(provider) {
    return createTransportForProvider(provider);
  },
};

export const useVaultStore = createVaultStore(resolver);
