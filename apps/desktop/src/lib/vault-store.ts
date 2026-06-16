import { createOpfsVaultRegistry, registerDriver, VaultOrchestrator } from '@timenote/core';
import { LocalFsDriver } from '@timenote/core/fs/adapters/localfs/opfs';
import { S3Driver } from '@timenote/core/fs/adapters/s3/s3';
import { WebdavDriver } from '@timenote/core/fs/adapters/webdav/webdav';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';

export type { VaultMeta } from '@timenote/core';

registerDriver('localfs', LocalFsDriver);
registerDriver('s3', S3Driver);
registerDriver('webdav', WebdavDriver);

const orchestrator = new VaultOrchestrator(
  createOpfsVaultRegistry,
  createLocalStorageProviderStore(),
);
export const useVaultStore = createBoundVaultStore(orchestrator);
