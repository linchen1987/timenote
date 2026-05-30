import type { StorageProviderConfig } from './providers';
import { createTransportFromConfig } from './providers';

export { createTransportFromConfig } from './providers';

export async function testConnection(config: StorageProviderConfig): Promise<boolean> {
  try {
    const transport = createTransportFromConfig(config);
    return await transport.exists('/');
  } catch {
    return false;
  }
}
