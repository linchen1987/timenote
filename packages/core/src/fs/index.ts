export type { FsClient, FsClientConfig, FsClientStat, FsCredentials, FsEndpoint, FsRootPath, FsScheme, FsVolume, FsVolumeAccess, FsVolumeAccessStore, LocalFsClientConfig, LocalFsEndpoint, LocalFsVolume, LocalFsVolumeAccess, S3ClientConfig, S3Credentials, S3Endpoint, S3Volume, S3VolumeAccess, WebdavClientConfig, WebdavCredentials, WebdavEndpoint, WebdavVolume, WebdavVolumeAccess } from './types';
export { createFsClient } from './client';
export type { FsClientDriver } from './driver-registry';
export { clearDrivers, getDriver, registerDriver } from './driver-registry';
export { computeVolumeUrl, extractScheme, parseVolumeUrl, resolveFsConfig } from './url';

export {
  createOpfsClient,
  createS3Client,
  createWebdavClient,
  S3Driver,
  WebdavDriver,
} from './adapters';
