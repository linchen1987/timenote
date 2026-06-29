import { createBrowserVaultRegistry, registerDriver, VaultOrchestrator } from '@timenote/core';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';
import { S3RpcDriver, WebdavRpcDriver } from './web-transport';

if (typeof window !== 'undefined') {
  registerDriver('s3', S3RpcDriver);
  registerDriver('webdav', WebdavRpcDriver);
}

const orchestrator = new VaultOrchestrator(
  createBrowserVaultRegistry,
  createLocalStorageProviderStore(),
);
export const useVaultStore = createBoundVaultStore(orchestrator);
