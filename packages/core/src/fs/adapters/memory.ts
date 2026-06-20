import type { FsClient, FsClientStat } from '../types';

/**
 * In-memory FsClient. Holds files/binaries/dirs in Maps; never touches disk.
 * Useful for ephemeral operations (e.g. one-shot remote writes) and for tests.
 * `scheme` is not a real driver scheme — the memory client is never registered
 * as a driver and only used as an ad-hoc local side that the sync engine drives
 * through the FsClient contract.
 */
export function createMemoryProvider(): FsClient {
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

/**
 * Wrap an FsClient so all paths are prefixed with `prefix`.
 * Used to namespace operations under a subdirectory of a volume.
 */
export function prefixClient(prefix: string, inner: FsClient): FsClient {
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
