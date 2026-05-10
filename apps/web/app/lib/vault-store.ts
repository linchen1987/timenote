import { createVaultStore } from '@timenote/core';
import { webTransport } from './web-transport';

export const useVaultStore = createVaultStore(webTransport);
