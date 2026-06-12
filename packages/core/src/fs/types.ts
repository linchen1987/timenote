export type FsScheme = 'localfs' | 's3' | 'webdav';
export type FsRootPath = string;
export type FsCredentials =
  | { accessKeyId: string; secretAccessKey: string; region?: string }
  | { password?: string };

import type {
  LocalFsClientConfig,
  LocalFsEndpoint,
  LocalFsVolume,
  LocalFsVolumeAccess,
} from './adapters/localfs/types';
import type {
  S3ClientConfig,
  S3Credentials,
  S3Endpoint,
  S3Volume,
  S3VolumeAccess,
} from './adapters/s3/s3';
import type {
  WebdavClientConfig,
  WebdavCredentials,
  WebdavEndpoint,
  WebdavVolume,
  WebdavVolumeAccess,
} from './adapters/webdav/webdav';

export type {
  LocalFsClientConfig,
  LocalFsEndpoint,
  LocalFsVolume,
  LocalFsVolumeAccess,
} from './adapters/localfs/types';
export type {
  S3ClientConfig,
  S3Credentials,
  S3Endpoint,
  S3Volume,
  S3VolumeAccess,
} from './adapters/s3/s3';
export type {
  WebdavClientConfig,
  WebdavCredentials,
  WebdavEndpoint,
  WebdavVolume,
  WebdavVolumeAccess,
} from './adapters/webdav/webdav';

export type FsVolume = LocalFsVolume | S3Volume | WebdavVolume;

export type FsVolumeAccess = LocalFsVolumeAccess | S3VolumeAccess | WebdavVolumeAccess;

export type FsEndpoint = LocalFsEndpoint | S3Endpoint | WebdavEndpoint;

export type FsClientConfig = LocalFsClientConfig | S3ClientConfig | WebdavClientConfig;

export interface FsVolumeAccessStore {
  getVolumeAccess(volumeUrl: string): FsVolumeAccess | null;
  saveVolumeAccess(access: FsVolumeAccess): FsVolumeAccess & { volumeUrl: string };
  listVolumeAccesses(): (FsVolumeAccess & { volumeUrl: string })[];
  deleteVolumeAccess(volumeUrl: string): void;
}

export interface FsClient {
  list(path: string): Promise<FsClientStat[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;

  readonly scheme: FsScheme;
  readonly volumeUrl: string;
  readonly url: string;
  readonly rootPath: FsRootPath;
  readonly credentials: FsCredentials | undefined;

  testConnection(): Promise<boolean>;
}

export type FsClientStat = {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  mime?: string;
  etag?: string | null;
};
