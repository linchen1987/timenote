import type { FsProvider } from '../provider';
import type { FsAccount, FsConfig, FsEndpoint, FsIdentity } from './fs/def';
import type { S3Account, S3Config, S3Endpoint, S3Identity } from './s3/s3';
import type { WebdavAccount, WebdavConfig, WebdavEndpoint, WebdavIdentity } from './webdav/webdav';

export type FsProviderType = 'fs' | 's3' | 'webdav';

export type FsProviderIdentity = FsIdentity | S3Identity | WebdavIdentity;

export type FsProviderEndpoint = FsEndpoint | S3Endpoint | WebdavEndpoint;

export type FsProviderAccount = FsAccount | S3Account | WebdavAccount;

export type FsProviderConfig = FsConfig | S3Config | WebdavConfig;

export interface ProviderModule<I extends FsProviderIdentity = FsProviderIdentity> {
  scheme: string;
  getProviderId(identity: I): string;
  parseSource(userinfo: string, host: string, path: string): FsProviderEndpoint & { type: I['type'] };
  create(config: FsProviderConfig & { type: I['type'] }): FsProvider;
}

export type AnyProviderModule = ProviderModule;
