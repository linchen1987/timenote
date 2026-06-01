import type { FsProvider } from '../provider';
import { fsModule } from './fs/def';
import type {
  AnyProviderModule,
  FsProviderAccount,
  FsProviderConfig,
  FsProviderEndpoint,
  FsProviderIdentity,
} from './module';
import { s3Module } from './s3/s3';
import { webdavModule } from './webdav/webdav';

export type { FsAccount, FsConfig, FsEndpoint, FsIdentity } from './fs/def';
export { getRuntimeFactory, registerRuntimeFactory } from './fs/def';
export { createOpfsProvider } from './fs/opfs';
export type {
  AnyProviderModule,
  FsProviderAccount,
  FsProviderConfig,
  FsProviderEndpoint,
  FsProviderIdentity,
  FsProviderType,
  ProviderModule,
} from './module';
export type { S3Account, S3Config, S3Credentials, S3Endpoint, S3Identity } from './s3/s3';
export { createS3Provider } from './s3/s3';
export type {
  WebdavAccount,
  WebdavConfig,
  WebdavCredentials,
  WebdavEndpoint,
  WebdavIdentity,
} from './webdav/webdav';
export { createWebdavProvider } from './webdav/webdav';

const modules: Record<string, AnyProviderModule> = {
  fs: fsModule,
  s3: s3Module,
  webdav: webdavModule,
};

const SCHEME_MAP = new Map<string, string>(Object.values(modules).map((m) => [m.scheme, m.scheme]));

export function registerModule(name: string, module: AnyProviderModule): void {
  modules[name] = module;
  SCHEME_MAP.set(module.scheme, module.scheme);
}

function findModule(scheme: string): AnyProviderModule {
  const key = SCHEME_MAP.get(scheme);
  if (!key) throw new Error(`Unsupported scheme: ${scheme}`);
  return modules[key];
}

export function getProviderId(identity: FsProviderIdentity): string {
  const module = findModule(identity.type);
  return module.getProviderId(identity);
}

export function configToUrl(config: FsProviderEndpoint): string {
  const id = getProviderId(config);
  return config.path && config.path !== '/' ? `${id}/${config.path}` : id;
}

export function parseSourceUrl(url: string): FsProviderEndpoint {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0) throw new Error(`Invalid source URL: ${url}`);
  const scheme = url.slice(0, protoIdx);
  const module = findModule(scheme);
  return module.parseUrl(url) as FsProviderEndpoint;
}

export interface FsProviderStore {
  getProvider(id: string): FsProviderAccount | null;
  saveProvider(account: FsProviderAccount): FsProviderEntry;
  listProviders(): FsProviderEntry[];
  deleteProvider(id: string): void;
}

export type FsProviderEntry = FsProviderAccount & { id: string };

export function toProviderEntry(account: FsProviderAccount): FsProviderEntry {
  const id = getProviderId(account);
  return { ...account, id };
}

function scopeToPath(prefix: string, provider: FsProvider): FsProvider {
  const p = prefix.replace(/\/+$/, '');
  const resolve = (path: string) => (path ? `${p}/${path}` : p);
  return {
    list: (path) => provider.list(resolve(path)),
    read: (path) => provider.read(resolve(path)),
    write: (path, content) => provider.write(resolve(path), content),
    readBinary: (path) => provider.readBinary(resolve(path)),
    writeBinary: (path, data) => provider.writeBinary(resolve(path), data),
    exists: (path) => provider.exists(resolve(path)),
    ensureDir: (path) => provider.ensureDir(resolve(path)),
    remove: (path) => provider.remove(resolve(path)),
  };
}

export function createFsProvider(config: FsProviderConfig): FsProvider {
  const module = findModule(config.type);
  const provider = module.create(config);
  return config.path && config.path !== '/' ? scopeToPath(config.path, provider) : provider;
}

export function createFsProviderFromUrl(url: string, store: FsProviderStore): FsProvider {
  const endpoint = parseSourceUrl(url);
  const providerId = getProviderId(endpoint);
  const stored = store.getProvider(providerId) ?? { type: endpoint.type };
  const config = { ...stored, path: endpoint.path } as FsProviderConfig;
  return createFsProvider(config);
}

export function createProviderFromConfig(config: FsProviderConfig): FsProvider {
  const module = findModule(config.type);
  return module.create(config);
}

export async function testConnection(config: FsProviderConfig): Promise<boolean> {
  try {
    const transport = createProviderFromConfig(config);
    return await transport.exists('/');
  } catch {
    return false;
  }
}
