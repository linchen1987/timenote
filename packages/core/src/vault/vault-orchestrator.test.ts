import { describe, expect, it } from 'vitest';
import type { FsClient, FsClientStat } from '../fs/client';
import { scopeToPath } from '../fs/client';
import {
  type FsProvider,
  type FsProviderAccount,
  type FsProviderConfig,
  type FsProviderIdentity,
  type FsProviderStore,
  registerProvider,
} from '../fs/providers';
import { VaultOrchestrator } from './vault-orchestrator';
import type { VaultRegistry, VaultRegistryEntry } from './vault-registry';

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
    },
  };
}

const S3_PROVIDER_ID = 's3://test-endpoint@test-bucket';
const _S3_URL_WITH_PATH = 's3://test-endpoint@test-bucket/timenote/vaults/abc';
const S3_ACCOUNT: FsProviderAccount = {
  type: 's3',
  endpoint: 'test-endpoint',
  bucket: 'test-bucket',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
};
const _S3_CONFIG: FsProviderConfig = { ...S3_ACCOUNT, path: '/' };

const mockS3Provider: FsProvider = {
  scheme: 's3',
  getProviderId: (i: FsProviderIdentity) => {
    const s3 = i as { type: 's3'; endpoint: string; bucket: string };
    return `s3://${s3.endpoint}@${s3.bucket}`;
  },
  parseUrl: (url: string) => {
    const protoIdx = url.indexOf('://');
    const rest = url.slice(protoIdx + 3);
    const lastAt = rest.lastIndexOf('@');
    if (lastAt < 0) {
      const slashIdx = rest.indexOf('/');
      return {
        type: 's3' as const,
        endpoint: slashIdx < 0 ? rest : rest.slice(0, slashIdx),
        bucket: '',
        path: slashIdx < 0 ? '/' : rest.slice(slashIdx + 1),
      };
    }
    const afterAt = rest.slice(lastAt + 1);
    const slashIdx = afterAt.indexOf('/');
    return {
      type: 's3' as const,
      endpoint: rest.slice(0, lastAt),
      bucket: slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx),
      path: slashIdx < 0 ? '/' : afterAt.slice(slashIdx + 1),
    };
  },
  buildUrl: (endpoint: any) => {
    const id = `s3://${(endpoint as any).endpoint}@${(endpoint as any).bucket}`;
    return endpoint.path && endpoint.path !== '/' ? `${id}/${endpoint.path}` : id;
  },
  create: () => {
    throw new Error('use recording provider');
  },
  testConnection: async () => true,
  toEntry: (account: any) => {
    const m = mockS3Provider;
    return { ...account, id: m.getProviderId(account) };
  },
  resolveConfigFromUrl: (url: string, store: FsProviderStore) => {
    const m = mockS3Provider;
    const endpoint = m.parseUrl(url);
    const id = m.getProviderId(endpoint);
    const stored = store.getProvider(id);
    if (!stored || stored.type !== 's3') throw new Error(`S3 provider not configured: ${id}`);
    return { ...stored, path: endpoint.path };
  },
  createFromUrl: () => {
    throw new Error('use recording provider');
  },
};

function createMockStore(): FsProviderStore {
  return {
    getProvider: (id: string) => (id === S3_PROVIDER_ID ? S3_ACCOUNT : null),
    saveProvider: () => ({ ...S3_ACCOUNT, id: S3_PROVIDER_ID }),
    listProviders: () => [{ ...S3_ACCOUNT, id: S3_PROVIDER_ID }],
    deleteProvider: () => {},
  };
}

function createMemoryRegistry(): VaultRegistry {
  const providers = new Map<string, FsClient>();

  return {
    async list(): Promise<VaultRegistryEntry[]> {
      return Array.from(providers.keys()).map((id) => ({
        projectId: id,
        sourceUrl: `fs:///vaults/${id}`,
        name: id,
      }));
    },
    async get(projectId: string): Promise<VaultRegistryEntry | null> {
      return providers.has(projectId)
        ? { projectId, sourceUrl: `fs:///vaults/${projectId}`, name: projectId }
        : null;
    },
    async register(projectId: string, _name: string): Promise<VaultRegistryEntry> {
      providers.set(projectId, createMemoryProvider());
      return { projectId, sourceUrl: `fs:///vaults/${projectId}`, name: projectId };
    },
    async unregister() {},
    async destroy(projectId: string) {
      providers.delete(projectId);
    },
    async getProvider(projectId: string): Promise<FsClient> {
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
  it('sync uses path prefix via createFsClient (direct path)', async () => {
    const recording = createRecordingProvider();

    registerProvider('s3', {
      ...mockS3Provider,
      create: (config: any) => {
        const provider = recording.provider;
        if (config.path && config.path !== '/') return scopeToPath(config.path, provider);
        return provider;
      },
    });

    const orchestrator = new VaultOrchestrator(createMemoryRegistry(), createMockStore());

    await orchestrator.init();
    const projectId = await orchestrator.createVault('test-vault');

    const localProvider = await orchestrator.getVaultProvider(projectId);
    await localProvider.write('2026-01/20260101-120000-abcd.md', 'test content');

    await orchestrator.configureRemote(projectId, S3_PROVIDER_ID, 'timenote/vaults/abc');
    await orchestrator.sync(projectId);

    expect(recording.paths.length).toBeGreaterThan(0);
    expect(recording.paths.every((p) => p.startsWith('timenote/vaults/abc'))).toBe(true);
  });

  it('sync uses path prefix via rpcProviderFactory (RPC path)', async () => {
    const recording = createRecordingProvider();

    const rpcProviderFactory = (config: FsProviderConfig): FsClient => {
      if (config.type !== 's3') throw new Error(`Unexpected type: ${config.type}`);
      const s3Config = config as FsProviderConfig & { type: 's3' };
      if (s3Config.path !== 'timenote/vaults/abc')
        throw new Error(`Unexpected path: ${s3Config.path}`);
      const prefix = 'timenote/vaults/abc';
      const resolve = (path: string) => (path ? `${prefix}/${path}` : prefix);
      const inner = recording.provider;
      return {
        list: (path) => inner.list(resolve(path)),
        read: (path) => inner.read(resolve(path)),
        write: (path, content) => inner.write(resolve(path), content),
        readBinary: (path) => inner.readBinary(resolve(path)),
        writeBinary: (path, data) => inner.writeBinary(resolve(path), data),
        exists: (path) => inner.exists(resolve(path)),
        ensureDir: (path) => inner.ensureDir(resolve(path)),
        remove: (path) => inner.remove(resolve(path)),
      };
    };

    const orchestrator = new VaultOrchestrator(
      createMemoryRegistry(),
      createMockStore(),
      rpcProviderFactory,
    );

    await orchestrator.init();
    const projectId = await orchestrator.createVault('test-vault');

    const localProvider = await orchestrator.getVaultProvider(projectId);
    await localProvider.write('2026-01/20260101-120000-abcd.md', 'test content');

    await orchestrator.configureRemote(projectId, S3_PROVIDER_ID, 'timenote/vaults/abc');
    await orchestrator.sync(projectId);

    expect(recording.paths.length).toBeGreaterThan(0);
    expect(recording.paths.every((p) => p.startsWith('timenote/vaults/abc'))).toBe(true);
  });
});
