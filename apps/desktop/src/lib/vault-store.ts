import { registerDriver, VaultOrchestrator } from '@timenote/core';
import { S3Driver } from '@timenote/core/fs/adapters/s3/s3';
import { WebdavDriver } from '@timenote/core/fs/adapters/webdav/webdav';
import { createBoundVaultStore, type VaultStore } from '@timenote/ui';
import { loadConfig } from './desktop-config';
import { loadVolumeStore } from './file-volume-store';
import { TauriFsDriver } from './tauri-fs-driver';
import { createDesktopVaultRegistry } from './tauri-vault-registry';

export type { VaultMeta } from '@timenote/core';
export type { VaultStore } from '@timenote/ui';

registerDriver('localfs', TauriFsDriver);
registerDriver('s3', S3Driver);
registerDriver('webdav', WebdavDriver);

type BoundVaultStore = ReturnType<typeof createBoundVaultStore>;

let _useVaultStore: BoundVaultStore | null = null;
let _registry: Awaited<ReturnType<typeof createDesktopVaultRegistry>> | null = null;

export async function initDesktopStores(): Promise<void> {
  if (_useVaultStore) return;

  const volumeStore = await loadVolumeStore();
  await loadConfig();

  _registry = await createDesktopVaultRegistry();

  const orchestrator = new VaultOrchestrator(_registry, volumeStore);
  _useVaultStore = createBoundVaultStore(orchestrator);
}

export const useVaultStore = Object.assign(
  (...args: Parameters<BoundVaultStore>): ReturnType<BoundVaultStore> => {
    if (!_useVaultStore) throw new Error('useVaultStore called before initDesktopStores()');
    return _useVaultStore(...args);
  },
  {
    getState: (): VaultStore => {
      if (!_useVaultStore) throw new Error('useVaultStore called before initDesktopStores()');
      return _useVaultStore.getState();
    },
    setState: (...args: Parameters<BoundVaultStore['setState']>): void => {
      if (!_useVaultStore) throw new Error('useVaultStore called before initDesktopStores()');
      _useVaultStore.setState(...args);
    },
  },
) as BoundVaultStore;

export async function getDesktopRegistry() {
  if (!_registry) {
    await loadConfig();
    _registry = await createDesktopVaultRegistry();
  }
  return _registry;
}
