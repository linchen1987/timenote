import { createVaultStore, type FsTransport, type TransportResolver } from '@timenote/core';
import { createTransportForProvider } from './web-transport';

const resolver: TransportResolver = {
  createTransport(provider): FsTransport {
    return createTransportForProvider(provider);
  },
};

export const useVaultStore = createVaultStore(resolver);
