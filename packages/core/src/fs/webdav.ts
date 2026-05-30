import { createClient } from 'webdav';
import type { FsStat, FsTransport } from './transport';

export function createWebdavTransport(
  baseUrl: string,
  username: string,
  password?: string,
): FsTransport {
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
    async list(dirPath: string): Promise<FsStat[]> {
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
