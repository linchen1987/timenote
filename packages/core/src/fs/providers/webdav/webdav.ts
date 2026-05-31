import { createClient } from 'webdav';
import type { FsProvider, FsProviderStat } from '../../provider';
import type { ProviderModule } from '../module';

export type WebdavIdentity = { type: 'webdav'; host: string; username: string };

export type WebdavConfig = WebdavIdentity & {
  password?: string;
  token?: string;
  tls?: boolean;
  port?: number;
};

function createWebdavProvider(baseUrl: string, username: string, password?: string): FsProvider {
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
    async list(dirPath: string): Promise<FsProviderStat[]> {
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
        current += '/' + part;
        try {
          await c.stat(current);
        } catch {
          await c.createDirectory(current);
        }
      }
    },
  };
}

export const webdavModule: ProviderModule<WebdavIdentity, WebdavConfig> = {
  scheme: 'webdav',

  generateId({ username, host }: WebdavIdentity): string {
    return `webdav://${username}@${host}`;
  },

  parseSource(userinfo: string, host: string, path: string): WebdavIdentity & { path: string } {
    return { type: 'webdav', username: userinfo, host, path };
  },

  create(identity: WebdavIdentity, config: WebdavConfig): FsProvider {
    const protocol = config.tls !== false ? 'https' : 'http';
    const defaultPort = config.tls !== false ? 443 : 80;
    const baseUrl =
      config.port && config.port !== defaultPort
        ? `${protocol}://${config.host}:${config.port}`
        : `${protocol}://${config.host}`;
    return createWebdavProvider(baseUrl, identity.username, config.password);
  },
};

export { createWebdavProvider };
