import { createVaultStore } from '@timenote/core/vault';
import { webTransport } from './web-transport';

export const useVaultStore = createVaultStore(webTransport);
