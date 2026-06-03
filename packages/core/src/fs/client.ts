import type { FsClient, FsClientConfig, FsScheme } from './types';
import { getDriver } from './driver-registry';
import { resolveFsConfig } from './url';
import type { FsVolumeAccessStore } from './types';

export function createFsClient(
  configOrUrl: FsClientConfig | string,
  store?: FsVolumeAccessStore,
): FsClient {
  if (typeof configOrUrl === 'string') {
    const config = resolveFsConfig(configOrUrl, store);
    return getDriver(config.scheme as FsScheme).create(config);
  }
  return getDriver(configOrUrl.scheme as FsScheme).create(configOrUrl);
}
