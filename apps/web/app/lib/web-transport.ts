import type { FsClient, FsClientConfig, FsClientDriver, FsClientStat } from '@timenote/core';

function createRpcProxy(config: FsClientConfig): FsClient {
  async function callApi<T = unknown>(method: string, path: string, args?: unknown): Promise<T> {
    const res = await fetch('/api/fs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, method, path, args }),
    });

    const data = (await res.json()) as { error?: string; result?: T };
    if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
    return data.result as T;
  }

  return {
    async list(path: string) {
      const result = await callApi<FsClientStat[]>('list', path);
      return Array.isArray(result) ? result : [result];
    },

    async read(path: string): Promise<string> {
      return callApi<string>('read', path);
    },

    async write(path: string, content: string) {
      await callApi('write', path, { content });
    },

    async readBinary(path: string): Promise<ArrayBuffer> {
      const res = await fetch('/api/fs/binary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, path }),
      });
      if (!res.ok) throw new Error('Binary read failed');
      return await res.arrayBuffer();
    },

    async writeBinary(path: string, data: ArrayBuffer) {
      const res = await fetch('/api/fs/binary', {
        method: 'POST',
        body: (() => {
          const fd = new FormData();
          fd.append('meta', JSON.stringify({ config, path }));
          fd.append('file', new File([data], 'upload', { type: 'application/octet-stream' }));
          return fd;
        })(),
      });
      if (!res.ok) {
        let detail = `Binary write failed (${res.status})`;
        try {
          const text = await res.text();
          try {
            const body = JSON.parse(text) as { error?: string };
            if (body.error) detail = `Binary write failed: ${body.error}`;
          } catch {
            if (text) detail = `Binary write failed (${res.status}): ${text.slice(0, 200)}`;
          }
        } catch {}
        throw new Error(detail);
      }
    },

    async exists(path: string): Promise<boolean> {
      try {
        await callApi('exists', path);
        return true;
      } catch {
        return false;
      }
    },

    async ensureDir(path: string) {
      await callApi('ensureDir', path);
    },

    async remove(path: string) {
      await callApi('remove', path);
    },

    get scheme() {
      return config.scheme as never;
    },
    get volumeUrl() {
      if ('bucket' in config) return `s3://${(config as any).bucket}@${(config as any).endpoint}`;
      if ('host' in config) return `webdav://${(config as any).username}@${(config as any).host}`;
      return 'rpc://';
    },
    get url() {
      return this.volumeUrl;
    },
    get rootPath() {
      return (config as any).rootPath ?? '/';
    },
    get credentials() {
      return undefined;
    },
    async testConnection() {
      return true;
    },
  };
}

export const S3RpcDriver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    const { rootPath: configPath, ...credentials } = config as any;
    const proxy = createRpcProxy({ ...credentials, rootPath: '/' } as FsClientConfig);
    const prefix = configPath?.replace(/\/+$/, '');
    if (!prefix || prefix === '/') return proxy;

    const resolve = (path: string) => (path ? `${prefix}/${path}` : prefix);
    return {
      list: (path) => proxy.list(resolve(path)),
      read: (path) => proxy.read(resolve(path)),
      write: (path, content) => proxy.write(resolve(path), content),
      readBinary: (path) => proxy.readBinary(resolve(path)),
      writeBinary: (path, data) => proxy.writeBinary(resolve(path), data),
      exists: (path) => proxy.exists(resolve(path)),
      ensureDir: (path) => proxy.ensureDir(resolve(path)),
      remove: (path) => proxy.remove(resolve(path)),

      scheme: proxy.scheme,
      volumeUrl: proxy.volumeUrl,
      url: proxy.url,
      rootPath: prefix as never,
      credentials: proxy.credentials,
      testConnection: () => proxy.testConnection(),
    };
  },
};

export const WebdavRpcDriver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    return S3RpcDriver.create(config);
  },
};
