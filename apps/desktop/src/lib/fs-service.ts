import { createFsClient } from '@timenote/core';

export function testProviderConnection(config: Parameters<typeof createFsClient>[0]) {
  return createFsClient(config).testConnection();
}
