import { S3Driver } from './adapters/s3/s3';
import { WebdavDriver } from './adapters/webdav/webdav';
import type { FsClient, FsClientConfig, FsScheme } from './types';

export interface FsClientDriver {
  create(config: FsClientConfig): FsClient;
}

const drivers = new Map<FsScheme, FsClientDriver>([
  ['s3', S3Driver],
  ['webdav', WebdavDriver],
]);

export function registerDriver(scheme: FsScheme, driver: FsClientDriver): void {
  drivers.set(scheme, driver);
}

export function getDriver(scheme: FsScheme): FsClientDriver {
  const driver = drivers.get(scheme);
  if (!driver) throw new Error(`Unsupported scheme: ${scheme}`);
  return driver;
}

export function clearDrivers(): void {
  drivers.clear();
}
