import type { ProviderConfig } from '@timenote/core';
import { createTransportForProvider } from './web-transport';

export function testProviderConnection(provider: ProviderConfig): Promise<boolean> {
  const transport = createTransportForProvider(provider);
  return transport.exists('/');
}
