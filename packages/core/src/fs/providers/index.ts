import type { FsClient } from '../client';
import { fsProvider } from './fs/def';
import type {
  FsProvider,
  FsProviderAccount,
  FsProviderConfig,
  FsProviderEndpoint,
  FsProviderIdentity,
  FsProviderStore,
} from './provider';
import { s3Provider } from './s3/s3';
import { webdavProvider } from './webdav/webdav';

export type { FsAccount, FsConfig, FsEndpoint, FsIdentity } from './fs/def';
export { getRuntimeFactory, registerRuntimeFactory } from './fs/def';
export { createOpfsClient } from './fs/opfs';
export type {
  FsProvider,
  FsProviderAccount,
  FsProviderConfig,
  FsProviderEndpoint,
  FsProviderEntry,
  FsProviderIdentity,
  FsProviderStore,
  FsProviderType,
} from './provider';
export type { S3Account, S3Config, S3Credentials, S3Endpoint, S3Identity } from './s3/s3';
export { createS3Client } from './s3/s3';
export type {
  WebdavAccount,
  WebdavConfig,
  WebdavCredentials,
  WebdavEndpoint,
  WebdavIdentity,
} from './webdav/webdav';
export { createWebdavClient } from './webdav/webdav';

const providers: Record<string, FsProvider> = {
  fs: fsProvider,
  s3: s3Provider,
  webdav: webdavProvider,
};

const SCHEME_MAP = new Map<string, string>(Object.values(providers).map((m) => [m.scheme, m.scheme]));

function findProvider(scheme: string): FsProvider {
  const key = SCHEME_MAP.get(scheme);
  if (!key) throw new Error(`Unsupported scheme: ${scheme}`);
  return providers[key];
}

/** @internal Only for testing - register a custom provider */
export function registerProvider(name: string, provider: FsProvider): void {
  providers[name] = provider;
  SCHEME_MAP.set(provider.scheme, provider.scheme);
}

export const providerFacade: FsProvider = {
  scheme: '*',
  getProviderId(identity: FsProviderIdentity): string {
    return findProvider(identity.type).getProviderId(identity);
  },

  parseUrl(url: string): FsProviderEndpoint {
    const protoIdx = url.indexOf('://');
    if (protoIdx < 0) throw new Error(`Invalid source URL: ${url}`);
    const scheme = url.slice(0, protoIdx);
    return findProvider(scheme).parseUrl(url) as FsProviderEndpoint;
  },

  buildUrl(endpoint: FsProviderEndpoint): string {
    return findProvider(endpoint.type).buildUrl(endpoint);
  },

  create(config: FsProviderConfig): FsClient {
    return findProvider(config.type).create(config);
  },

  testConnection(config: FsProviderConfig): Promise<boolean> {
    return findProvider(config.type).testConnection(config);
  },

  toEntry(account: FsProviderAccount) {
    return findProvider(account.type).toEntry(account);
  },

  resolveConfigFromUrl(url: string, store: FsProviderStore) {
    const protoIdx = url.indexOf('://');
    if (protoIdx < 0) throw new Error(`Invalid source URL: ${url}`);
    const scheme = url.slice(0, protoIdx);
    return findProvider(scheme).resolveConfigFromUrl(url, store);
  },

  createFromUrl(url: string, store: FsProviderStore): FsClient {
    const protoIdx = url.indexOf('://');
    if (protoIdx < 0) throw new Error(`Invalid source URL: ${url}`);
    const scheme = url.slice(0, protoIdx);
    return findProvider(scheme).createFromUrl(url, store);
  },
};
