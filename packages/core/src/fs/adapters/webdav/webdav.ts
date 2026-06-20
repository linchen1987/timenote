import { createClient } from 'webdav';
import type { FsClientDriver } from '../../driver-registry';
import type { FsClient, FsClientConfig, FsClientStat, FsVolumeCredentialStore } from '../../types';

export type WebdavVolume = { scheme: 'webdav'; host: string; username: string };

export type WebdavCredentials = {
  password?: string;
  token?: string;
  tls?: boolean;
  port?: number;
};

export type WebdavEndpoint = WebdavVolume & { rootPath: string };

export type WebdavVolumeCredential = WebdavVolume & WebdavCredentials;

export type WebdavClientConfig = WebdavVolume & WebdavCredentials & { rootPath: string };

function createWebdavClient(config: WebdavClientConfig): FsClient {
  const userAgent = 'Microsoft-WebDAV-MiniRedir/10.0.19041';
  let clientCache: ReturnType<typeof createClient> | null = null;

  const protocol = config.tls !== false ? 'https' : 'http';
  const defaultPort = config.tls !== false ? 443 : 80;
  const baseUrl =
    config.port && config.port !== defaultPort
      ? `${protocol}://${config.host}:${config.port}`
      : `${protocol}://${config.host}`;

  function getClient() {
    if (clientCache) return clientCache;
    clientCache = createClient(baseUrl, {
      username: config.username,
      password: config.password,
      headers: { 'User-Agent': userAgent },
    });
    return clientCache;
  }

  const volumeUrl = `webdav://${config.username}@${config.host}`;
  const prefix =
    config.rootPath && config.rootPath !== '/' ? config.rootPath.replace(/\/+$/, '') : '';
  const resolve = (path: string) => {
    if (!prefix) return path;
    return path ? `${prefix}/${path}` : prefix;
  };

  const client: FsClient = {
    async list(dirPath: string): Promise<FsClientStat[]> {
      const c = getClient();
      const items: any[] = await c.getDirectoryContents(resolve(dirPath) || '/');
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
      const buf: any = await c.getFileContents(resolve(filePath), { format: 'text' });
      return typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
    },

    async write(filePath: string, content: string): Promise<void> {
      const c = getClient();
      await c.putFileContents(resolve(filePath), content);
    },

    async readBinary(filePath: string): Promise<ArrayBuffer> {
      const c = getClient();
      const buf: any = await c.getFileContents(resolve(filePath));
      return typeof buf === 'string' ? (new TextEncoder().encode(buf).buffer as ArrayBuffer) : buf;
    },

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
      const c = getClient();
      await c.putFileContents(resolve(filePath), new Uint8Array(data));
    },

    async remove(filePath: string): Promise<void> {
      const c = getClient();
      await c.deleteFile(resolve(filePath));
    },

    async exists(filePath: string): Promise<boolean> {
      const c = getClient();
      try {
        await c.stat(resolve(filePath));
        return true;
      } catch {
        return false;
      }
    },

    async ensureDir(dirPath: string): Promise<void> {
      const c = getClient();
      const resolved = resolve(dirPath);
      const parts = resolved.split('/').filter(Boolean);
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

    scheme: 'webdav',
    volumeUrl,
    url: prefix ? `${volumeUrl}/${prefix}` : volumeUrl,
    rootPath: prefix || '/',
    credentials: config.password ? { password: config.password } : undefined,
    testConnection: async (): Promise<boolean> => {
      try {
        const exists = await client.exists('/');
        return !!exists;
      } catch (e) {
        console.error('[WebDAV testConnection]', e);
        throw e;
      }
    },
  };
  return client;
}

export function computeWebdavVolumeUrl({
  username,
  host,
}: {
  username: string;
  host: string;
}): string {
  return `webdav://${username}@${host}`;
}

export function parseWebdavUrl(url: string): WebdavEndpoint {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0 || url.slice(0, protoIdx) !== 'webdav') {
    throw new Error(`Invalid webdav URL: ${url}`);
  }
  const rest = url.slice(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');
  let username: string;
  let host: string;
  let rootPath: string;
  if (lastAt < 0) {
    const slashIdx = rest.indexOf('/');
    host = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
    rootPath = slashIdx < 0 ? '/' : rest.slice(slashIdx + 1);
    username = '';
  } else {
    username = rest.slice(0, lastAt);
    const afterAt = rest.slice(lastAt + 1);
    const slashIdx = afterAt.indexOf('/');
    host = slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx);
    rootPath = slashIdx < 0 ? '/' : afterAt.slice(slashIdx + 1);
  }
  return { scheme: 'webdav', username, host, rootPath };
}

export function resolveWebdavConfigFromUrl(
  url: string,
  store?: FsVolumeCredentialStore,
): WebdavClientConfig {
  const endpoint = parseWebdavUrl(url);
  const volumeUrl = computeWebdavVolumeUrl(endpoint);
  if (!store) throw new Error(`Store required to resolve config from URL for scheme 'webdav'`);
  const stored = store.getVolumeCredential(volumeUrl);
  if (!stored || stored.scheme !== 'webdav')
    throw new Error(`WebDAV provider not configured: ${volumeUrl}`);
  return { ...stored, rootPath: endpoint.rootPath } as WebdavClientConfig;
}

export const WebdavDriver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    return createWebdavClient(config as WebdavClientConfig);
  },
};

export { createWebdavClient };
