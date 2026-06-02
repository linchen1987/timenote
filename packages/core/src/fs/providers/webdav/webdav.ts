import { createClient } from 'webdav';
import type { FsClient, FsClientStat } from '../../client';
import { scopeToPath } from '../../client';
import type { FsProvider, FsProviderEntry, FsProviderStore } from '../provider';

export type WebdavIdentity = { type: 'webdav'; host: string; username: string };

export type WebdavCredentials = {
  password?: string;
  token?: string;
  tls?: boolean;
  port?: number;
};

export type WebdavEndpoint = WebdavIdentity & { path: string };

export type WebdavAccount = WebdavIdentity & WebdavCredentials;

export type WebdavConfig = WebdavIdentity & WebdavCredentials & { path: string };

function createWebdavClient(baseUrl: string, username: string, password?: string): FsClient {
  const userAgent = 'Microsoft-WebDAV-MiniRedir/10.0.19041';
  let clientCache: ReturnType<typeof createClient> | null = null;

  function getClient() {
    if (clientCache) return clientCache;
    clientCache = createClient(baseUrl, {
      username,
      password,
      headers: { 'User-Agent': userAgent },
    });
    return clientCache;
  }

  return {
    async list(dirPath: string): Promise<FsClientStat[]> {
      const c = getClient();
      const items: any[] = await c.getDirectoryContents(dirPath || '/');
      return items.map((item: any) => ({
        filename: item.filename?.replace(/^\//, '') || item.basename,
        basename: item.basename,
        lastmod: item.lastmod || new Date().toISOString(),
        size: item.size || 0,
        type: item.type === 'directory' ? ('directory' as const) : ('file' as const),
        mime: item.mime,
        etag: item.etag,
      }));
    },

    async read(filePath: string): Promise<string> {
      const c = getClient();
      const buf: any = await c.getFileContents(filePath, { format: 'text' });
      return typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
    },

    async write(filePath: string, content: string): Promise<void> {
      const c = getClient();
      await c.putFileContents(filePath, content);
    },

    async readBinary(filePath: string): Promise<ArrayBuffer> {
      const c = getClient();
      const buf: any = await c.getFileContents(filePath);
      return typeof buf === 'string' ? (new TextEncoder().encode(buf).buffer as ArrayBuffer) : buf;
    },

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
      const c = getClient();
      await c.putFileContents(filePath, new Uint8Array(data));
    },

    async remove(filePath: string): Promise<void> {
      const c = getClient();
      await c.deleteFile(filePath);
    },

    async exists(filePath: string): Promise<boolean> {
      const c = getClient();
      try {
        await c.stat(filePath);
        return true;
      } catch {
        return false;
      }
    },

    async ensureDir(dirPath: string): Promise<void> {
      const c = getClient();
      const parts = dirPath.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += `/${part}`;
        try {
          await c.stat(current);
        } catch {
          await c.createDirectory(current);
        }
      }
    },
  };
}

export const webdavProvider: FsProvider<WebdavIdentity> = {
  scheme: 'webdav',

  getProviderId({ username, host }: WebdavIdentity): string {
    return `webdav://${username}@${host}`;
  },

  parseUrl(url: string): WebdavEndpoint {
    const protoIdx = url.indexOf('://');
    if (protoIdx < 0 || url.slice(0, protoIdx) !== 'webdav') {
      throw new Error(`Invalid webdav URL: ${url}`);
    }
    const rest = url.slice(protoIdx + 3);
    const lastAt = rest.lastIndexOf('@');
    let username: string;
    let host: string;
    let path: string;
    if (lastAt < 0) {
      const slashIdx = rest.indexOf('/');
      host = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
      path = slashIdx < 0 ? '/' : rest.slice(slashIdx + 1);
      username = '';
    } else {
      username = rest.slice(0, lastAt);
      const afterAt = rest.slice(lastAt + 1);
      const slashIdx = afterAt.indexOf('/');
      host = slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx);
      path = slashIdx < 0 ? '/' : afterAt.slice(slashIdx + 1);
    }
    return { type: 'webdav', username, host, path };
  },

  buildUrl(endpoint: WebdavEndpoint): string {
    const id = this.getProviderId(endpoint);
    return endpoint.path && endpoint.path !== '/' ? `${id}/${endpoint.path}` : id;
  },

  create(config: WebdavConfig): FsClient {
    const protocol = config.tls !== false ? 'https' : 'http';
    const defaultPort = config.tls !== false ? 443 : 80;
    const baseUrl =
      config.port && config.port !== defaultPort
        ? `${protocol}://${config.host}:${config.port}`
        : `${protocol}://${config.host}`;
    const client = createWebdavClient(baseUrl, config.username, config.password);
    if (config.path && config.path !== '/') return scopeToPath(config.path, client);
    return client;
  },

  async testConnection(config: WebdavConfig): Promise<boolean> {
    try {
      const client = this.create(config);
      return await client.exists('/');
    } catch {
      return false;
    }
  },

  toEntry(account: WebdavAccount): FsProviderEntry {
    return { ...account, id: this.getProviderId(account) };
  },

  resolveConfigFromUrl(url: string, store: FsProviderStore): WebdavConfig {
    const endpoint = this.parseUrl(url);
    const id = this.getProviderId(endpoint);
    const stored = store.getProvider(id);
    if (!stored || stored.type !== 'webdav')
      throw new Error(`WebDAV provider not configured: ${id}`);
    return { ...stored, path: endpoint.path } as WebdavConfig;
  },

  createFromUrl(url: string, store: FsProviderStore): FsClient {
    return this.create(this.resolveConfigFromUrl(url, store));
  },
};

export { createWebdavClient };
