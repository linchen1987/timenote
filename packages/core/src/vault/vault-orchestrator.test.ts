import { afterEach, describe, expect, it } from 'vitest';
import type { FsClientDriver } from '../fs/driver-registry';
import { clearDrivers, registerDriver } from '../fs/driver-registry';
import type {
  FsClient,
  FsClientConfig,
  FsClientStat,
  FsVolumeCredential,
  FsVolumeCredentialStore,
} from '../fs/types';
import { VaultOrchestrator } from './vault-orchestrator';
import type { VaultRegistry, VaultRegistryEntry } from './vault-registry';

function prefixClient(prefix: string, inner: FsClient): FsClient {
  const p = prefix.replace(/\/+$/, '');
  const resolve = (path: string) => (path ? `${p}/${path}` : p);
  return {
    list: (path) => inner.list(resolve(path)),
    read: (path) => inner.read(resolve(path)),
    write: (path, content) => inner.write(resolve(path), content),
    readBinary: (path) => inner.readBinary(resolve(path)),
    writeBinary: (path, data) => inner.writeBinary(resolve(path), data),
    exists: (path) => inner.exists(resolve(path)),
    ensureDir: (path) => inner.ensureDir(resolve(path)),
    remove: (path) => inner.remove(resolve(path)),

    scheme: inner.scheme,
    volumeUrl: inner.volumeUrl,
    url: inner.volumeUrl && prefix ? `${inner.volumeUrl}/${prefix}` : inner.volumeUrl,
    rootPath: prefix,
    credentials: inner.credentials,
    testConnection: () => inner.testConnection(),
  };
}

function createMemoryProvider(): FsClient {
  const files = new Map<string, string>();
  const bins = new Map<string, ArrayBuffer>();
  const dirs = new Set<string>();

  return {
    async list(path: string): Promise<FsClientStat[]> {
      const prefix = path ? `${path}/` : '';
      const seen = new Set<string>();
      const stats: FsClientStat[] = [];
      for (const key of [...files.keys(), ...bins.keys()]) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf('/');
        const name = slash < 0 ? rest : rest.slice(0, slash);
        if (seen.has(name)) continue;
        seen.add(name);
        stats.push({
          filename: prefix + name,
          basename: name,
          lastmod: new Date().toISOString(),
          size: 0,
          type: slash < 0 ? 'file' : 'directory',
        });
      }
      return stats;
    },
    async read(path: string): Promise<string> {
      const v = files.get(path);
      if (v === undefined) throw new Error(`Not found: ${path}`);
      return v;
    },
    async write(path: string, content: string): Promise<void> {
      files.set(path, content);
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    },
    async readBinary(path: string): Promise<ArrayBuffer> {
      const v = bins.get(path);
      if (!v) throw new Error(`Not found: ${path}`);
      return v;
    },
    async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
      bins.set(path, data);
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    },
    async remove(path: string): Promise<void> {
      files.delete(path);
      bins.delete(path);
    },
    async exists(path: string): Promise<boolean> {
      return files.has(path) || bins.has(path) || dirs.has(path);
    },
    async ensureDir(path: string): Promise<void> {
      const parts = path.split('/');
      for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    },

    scheme: 'memory' as never,
    volumeUrl: 'memory://',
    url: 'memory://',
    rootPath: '/',
    credentials: undefined,
    testConnection: async () => true,
  };
}

function createRecordingProvider(): { provider: FsClient; paths: string[] } {
  const paths: string[] = [];
  const inner = createMemoryProvider();
  const record =
    (fn: (...a: never[]) => Promise<never>) =>
    async (path: string, ...rest: never[]): Promise<never> => {
      paths.push(path);
      return fn(path, ...rest);
    };

  return {
    paths,
    provider: {
      list: record(inner.list as never) as never,
      read: record(inner.read as never) as never,
      write: record(inner.write as never) as never,
      readBinary: record(inner.readBinary as never) as never,
      writeBinary: record(inner.writeBinary as never) as never,
      remove: record(inner.remove as never) as never,
      exists: record(inner.exists as never) as never,
      ensureDir: record(inner.ensureDir as never) as never,

      scheme: inner.scheme,
      volumeUrl: inner.volumeUrl,
      url: inner.url,
      rootPath: inner.rootPath,
      credentials: inner.credentials,
      testConnection: () => inner.testConnection(),
    },
  };
}

const S3_PROVIDER_ID = 's3://test-endpoint@test-bucket';
const _S3_URL_WITH_PATH = 's3://test-endpoint@test-bucket/timenote/vaults/abc';
const S3_ACCOUNT: FsVolumeCredential = {
  scheme: 's3',
  endpoint: 'test-endpoint',
  bucket: 'test-bucket',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
};
const _S3_CONFIG: FsClientConfig = { ...S3_ACCOUNT, rootPath: '/' };

function mockComputeS3VolumeUrl(i: { endpoint: string; bucket: string }): string {
  return `s3://${i.endpoint}@${i.bucket}`;
}

function mockParseS3Url(url: string) {
  const protoIdx = url.indexOf('://');
  const rest = url.slice(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');
  if (lastAt < 0) {
    const slashIdx = rest.indexOf('/');
    return {
      scheme: 's3' as const,
      endpoint: slashIdx < 0 ? rest : rest.slice(0, slashIdx),
      bucket: '',
      rootPath: slashIdx < 0 ? '/' : rest.slice(slashIdx + 1),
    };
  }
  const afterAt = rest.slice(lastAt + 1);
  const slashIdx = afterAt.indexOf('/');
  return {
    scheme: 's3' as const,
    endpoint: rest.slice(0, lastAt),
    bucket: slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx),
    rootPath: slashIdx < 0 ? '/' : afterAt.slice(slashIdx + 1),
  };
}

function mockResolveS3ConfigFromUrl(url: string, store: FsVolumeCredentialStore): FsClientConfig {
  const endpoint = mockParseS3Url(url);
  const id = mockComputeS3VolumeUrl(endpoint);
  const stored = store.getVolumeCredential(id);
  if (!stored || stored.scheme !== 's3') throw new Error(`S3 provider not configured: ${id}`);
  return { ...stored, rootPath: endpoint.rootPath } as FsClientConfig;
}

function createMockStore(): FsVolumeCredentialStore {
  return {
    getVolumeCredential: (id: string) => (id === S3_PROVIDER_ID ? S3_ACCOUNT : null),
    saveVolumeCredential: () => ({ ...S3_ACCOUNT, volumeUrl: S3_PROVIDER_ID }),
    listVolumeCredentials: () => [{ ...S3_ACCOUNT, volumeUrl: S3_PROVIDER_ID }],
    deleteVolumeCredential: () => {},
  };
}

function createMemoryRegistry(): VaultRegistry {
  const providers = new Map<string, FsClient>();

  return {
    async list(): Promise<VaultRegistryEntry[]> {
      return Array.from(providers.keys()).map((id) => ({
        projectId: id,
        sourceUrl: `localfs:///vaults/${id}`,
        name: id,
      }));
    },
    async get(projectId: string): Promise<VaultRegistryEntry | null> {
      return providers.has(projectId)
        ? { projectId, sourceUrl: `localfs:///vaults/${projectId}`, name: projectId }
        : null;
    },
    async register(projectId: string, _name: string): Promise<VaultRegistryEntry> {
      providers.set(projectId, createMemoryProvider());
      return { projectId, sourceUrl: `localfs:///vaults/${projectId}`, name: projectId };
    },
    async unregister() {},
    async destroy(projectId: string) {
      providers.delete(projectId);
    },
    async getLocalClient(projectId: string): Promise<FsClient> {
      let p = providers.get(projectId);
      if (!p) {
        p = createMemoryProvider();
        providers.set(projectId, p);
      }
      return p;
    },
  };
}

describe('VaultOrchestrator', () => {
  afterEach(() => {
    clearDrivers();
  });

  it('sync uses path prefix via createFsClient (direct path)', async () => {
    const recording = createRecordingProvider();

    const mockDriver: FsClientDriver = {
      create(config: any) {
        const provider = recording.provider;
        if (config.rootPath && config.rootPath !== '/')
          return prefixClient(config.rootPath, provider);
        return provider;
      },
    };

    registerDriver('s3', mockDriver);

    const orchestrator = new VaultOrchestrator(createMemoryRegistry(), createMockStore());

    await orchestrator.init();
    const projectId = await orchestrator.createVault('test-vault');

    const localProvider = await orchestrator.getLocalClient(projectId);
    await localProvider.write('2026-01/20260101-120000-abcd.md', 'test content');

    await orchestrator.configureRemote(projectId, S3_PROVIDER_ID, 'timenote/vaults/abc');
    await orchestrator.sync(projectId);

    expect(recording.paths.length).toBeGreaterThan(0);
    expect(recording.paths.every((p) => p.startsWith('timenote/vaults/abc'))).toBe(true);
  });

  it('sync uses registered driver (replaces rpcProviderFactory)', async () => {
    const recording = createRecordingProvider();

    const rpcDriver: FsClientDriver = {
      create(config: FsClientConfig): FsClient {
        if (config.scheme !== 's3') throw new Error(`Unexpected type: ${config.scheme}`);
        const s3Config = config as FsClientConfig & { scheme: 's3' };
        if (s3Config.rootPath !== 'timenote/vaults/abc')
          throw new Error(`Unexpected path: ${s3Config.rootPath}`);
        return prefixClient('timenote/vaults/abc', recording.provider);
      },
    };

    registerDriver('s3', rpcDriver);

    const orchestrator = new VaultOrchestrator(createMemoryRegistry(), createMockStore());

    await orchestrator.init();
    const projectId = await orchestrator.createVault('test-vault');

    const localProvider = await orchestrator.getLocalClient(projectId);
    await localProvider.write('2026-01/20260101-120000-abcd.md', 'test content');

    await orchestrator.configureRemote(projectId, S3_PROVIDER_ID, 'timenote/vaults/abc');
    await orchestrator.sync(projectId);

    expect(recording.paths.length).toBeGreaterThan(0);
    expect(recording.paths.every((p) => p.startsWith('timenote/vaults/abc'))).toBe(true);
  });
});
