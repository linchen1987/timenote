import { registerDriver } from '../driver-registry';
import { S3Driver } from './s3/s3';
import { WebdavDriver } from './webdav/webdav';

export { createOpfsClient } from './localfs/opfs';
export type {
  LocalFsClientConfig,
  LocalFsEndpoint,
  LocalFsVolume,
  LocalFsVolumeCredential,
} from './localfs/types';

export type {
  S3ClientConfig,
  S3Credentials,
  S3Endpoint,
  S3Volume,
  S3VolumeCredential,
} from './s3/s3';
export { createS3Client, S3Driver } from './s3/s3';
export type {
  WebdavClientConfig,
  WebdavCredentials,
  WebdavEndpoint,
  WebdavVolume,
  WebdavVolumeCredential,
} from './webdav/webdav';
export { createWebdavClient, WebdavDriver } from './webdav/webdav';

registerDriver('s3', S3Driver);
registerDriver('webdav', WebdavDriver);
