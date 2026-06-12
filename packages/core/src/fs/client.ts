import { getDriver } from './driver-registry';
import type { FsClient, FsClientConfig, FsScheme, FsVolumeAccessStore } from './types';
import { resolveFsConfig } from './url';

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
