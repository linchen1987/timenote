import type { StorageProviderConfig } from './providers';
import {
  createTransportFromConfig,
  createTransportFromParams,
  serializeTransportParams,
} from './providers';

export { createTransportFromConfig } from './providers';
export { createTransportFromParams } from './providers';
export { serializeTransportParams as configToConnection } from './providers';

export async function testConnection(config: StorageProviderConfig): Promise<boolean> {
  try {
    const transport = createTransportFromConfig(config);
    return await transport.exists('/');
  } catch {
    return false;
  }
}
