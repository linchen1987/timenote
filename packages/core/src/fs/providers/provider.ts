import type { FsClient } from '../client';
import type { FsAccount, FsConfig, FsEndpoint, FsIdentity } from './fs/def';
import type { S3Account, S3Config, S3Endpoint, S3Identity } from './s3/s3';
import type { WebdavAccount, WebdavConfig, WebdavEndpoint, WebdavIdentity } from './webdav/webdav';

export type FsProviderType = 'fs' | 's3' | 'webdav';

export type FsProviderIdentity = FsIdentity | S3Identity | WebdavIdentity;

export type FsProviderEndpoint = FsEndpoint | S3Endpoint | WebdavEndpoint;

export type FsProviderAccount = FsAccount | S3Account | WebdavAccount;

export type FsProviderConfig = FsConfig | S3Config | WebdavConfig;

export type FsProviderEntry = FsProviderAccount & { id: string };

export interface FsProviderStore {
  getProvider(id: string): FsProviderAccount | null;
  saveProvider(account: FsProviderAccount): FsProviderEntry;
  listProviders(): FsProviderEntry[];
  deleteProvider(id: string): void;
}

export interface FsProvider<I extends FsProviderIdentity = FsProviderIdentity> {
  scheme: string;
  getProviderId(identity: I): string;
  parseUrl(fullUrl: string): FsProviderEndpoint & { type: I['type'] };
  buildUrl(endpoint: FsProviderEndpoint & { type: I['type'] }): string;
  create(config: FsProviderConfig & { type: I['type'] }): FsClient;
  testConnection(config: FsProviderConfig & { type: I['type'] }): Promise<boolean>;
  toEntry(account: FsProviderAccount & { type: I['type'] }): FsProviderEntry;
  resolveConfigFromUrl(url: string, store: FsProviderStore): FsProviderConfig & { type: I['type'] };
  createFromUrl(url: string, store: FsProviderStore): FsClient;
}
