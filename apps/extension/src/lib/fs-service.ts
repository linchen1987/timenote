import type { ProviderConfig } from '@timenote/core';
import { createExtensionTransport } from './extension-transport';

export function testProviderConnection(provider: ProviderConfig): Promise<boolean> {
  const transport = createExtensionTransport(provider);
  return transport.exists('/');
}
