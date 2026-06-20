export {
  createOpfsClient,
  createS3Client,
  createWebdavClient,
  S3Driver,
  WebdavDriver,
} from './adapters';
export { type CreateFsClientOptions, createFsClient } from './client';
export type { FsClientDriver } from './driver-registry';
export { clearDrivers, getDriver, registerDriver } from './driver-registry';
export type {
  FsClient,
  FsClientConfig,
  FsClientStat,
  FsCredentials,
  FsEndpoint,
  FsRootPath,
  FsScheme,
  FsVolume,
  FsVolumeCredential,
  FsVolumeCredentialStore,
  LocalFsClientConfig,
  LocalFsEndpoint,
  LocalFsVolume,
  LocalFsVolumeCredential,
  S3ClientConfig,
  S3Credentials,
  S3Endpoint,
  S3Volume,
  S3VolumeCredential,
  WebdavClientConfig,
  WebdavCredentials,
  WebdavEndpoint,
  WebdavVolume,
  WebdavVolumeCredential,
} from './types';
export { computeVolumeUrl, extractScheme, parseVolumeUrl, resolveFsConfig } from './url';
