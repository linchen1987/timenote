import type { FsProvider } from '../provider';
import { fsModule } from './fs/def';
import type { AnyProviderModule, StorageProviderConfig, StorageProviderIdentity } from './module';
import { s3Module } from './s3/s3';
import { webdavModule } from './webdav/webdav';

export type { FsConfig, FsIdentity } from './fs/def';
export { getRuntimeFactory, registerRuntimeFactory } from './fs/def';
export { createOpfsProvider } from './fs/opfs';
export type {
  AnyProviderModule,
  ProviderModule,
  StorageProviderConfig,
  StorageProviderIdentity,
  StorageProviderType,
} from './module';
export type { S3Config, S3Identity } from './s3/s3';
export { createS3Provider } from './s3/s3';
export type { WebdavConfig, WebdavIdentity } from './webdav/webdav';
export { createWebdavProvider } from './webdav/webdav';

const modules: Record<string, AnyProviderModule> = {
  fs: fsModule,
  s3: s3Module,
  webdav: webdavModule,
};

const SCHEME_MAP = new Map<string, string>(Object.values(modules).map((m) => [m.scheme, m.scheme]));

function findModule(scheme: string): AnyProviderModule {
  const key = SCHEME_MAP.get(scheme);
  if (!key) throw new Error(`Unsupported scheme: ${scheme}`);
  return modules[key];
}

export function generateProviderId(identity: StorageProviderIdentity): string {
  const module = findModule(identity.type);
  return module.generateId(identity);
}

export function stringifySourceUrl(source: StorageProviderIdentity & { path: string }): string {
  const id = generateProviderId(source);
  return source.path ? `${id}/${source.path}` : id;
}

export function parseSourceUrl(url: string): StorageProviderIdentity & { path: string } {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0) throw new Error(`Invalid source URL: ${url}`);
  const scheme = url.slice(0, protoIdx);

  const module = findModule(scheme);

  const rest = url.slice(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');

  if (lastAt < 0) {
    const slashIdx = rest.indexOf('/');
    const host = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
    const path = slashIdx < 0 ? '' : rest.slice(slashIdx + 1);
    return module.parseSource('', host, path) as StorageProviderIdentity & { path: string };
  }

  const userinfo = rest.slice(0, lastAt);
  const afterAt = rest.slice(lastAt + 1);
  const slashIdx = afterAt.indexOf('/');
  const host = slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx);
  const path = slashIdx < 0 ? '' : afterAt.slice(slashIdx + 1);

  return module.parseSource(userinfo, host, path) as StorageProviderIdentity & { path: string };
}

export interface StorageProviderStore {
  getProvider(id: string): StorageProviderConfig | null;
  saveProvider(config: StorageProviderConfig): void;
  listProviders(): StorageProviderConfig[];
  deleteProvider(id: string): void;
}

export type StorageProviderEntry = StorageProviderConfig & { id: string };

export function toProviderEntry(config: StorageProviderConfig): StorageProviderEntry {
  const id = generateProviderId(config);
  return { ...config, id };
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

export function createFsProvider(sourceUrl: string, store: StorageProviderStore): FsProvider {
  const parsed = parseSourceUrl(sourceUrl);
  const providerId = generateProviderId(parsed);
  const path = parsed.path;

  const module = findModule(parsed.type);

  if (parsed.type === 'fs') {
    const provider = module.create(parsed, undefined as unknown as StorageProviderConfig);
    return path ? scopeToPath(path, provider) : provider;
  }

  const entry = store.getProvider(providerId);
  if (!entry) throw new Error(`Provider not configured: ${providerId}`);

  const provider = module.create(parsed, entry);
  return path ? scopeToPath(path, provider) : provider;
}

export function createProviderFromConfig(config: StorageProviderConfig): FsProvider {
  const module = findModule(config.type);
  return module.create(config as StorageProviderIdentity, config);
}

export async function testConnection(config: StorageProviderConfig): Promise<boolean> {
  try {
    const transport = createProviderFromConfig(config);
    return await transport.exists('/');
  } catch {
    return false;
  }
}
