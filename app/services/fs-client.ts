import { S3Client } from '@bradenmacdonald/s3-lite-client';
import { createClient, type FileStat, type WebDAVClient, type WebDAVClientOptions } from 'webdav';

export type FsConnection =
  | { type: 'webdav'; url: string; username?: string; password?: string; token?: string }
  | {
      type: 's3';
      bucket: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      region?: string;
    };

export type FsStat = {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  mime?: string;
  etag?: string | null;
};

export interface FsClient {
  readdir(path: string): Promise<FsStat[]>;
  readFile(path: string): Promise<ArrayBuffer>;
  writeFile(path: string, content: string | ArrayBuffer): Promise<void>;
  unlink(path: string): Promise<void>;
  stat(path: string): Promise<FsStat>;
  ensureDir(path: string): Promise<void>;
}

export function createFsClient(connection: FsConnection): FsClient {
  if (connection.type === 'webdav') {
    return new WebDavFsClient(connection);
  }
  if (connection.type === 's3') {
    return new S3FsClient(connection);
  }
  throw new Error(`Unsupported connection type: ${(connection as FsConnection).type}`);
}

class WebDavFsClient implements FsClient {
  private client: WebDAVClient;

  constructor(config: { url: string; username?: string; password?: string; token?: string }) {
    const options: WebDAVClientOptions = {
      // Explicitly pass the global fetch to ensure it uses the Cloudflare Workers fetch implementation
      // This is crucial for environments like CF Workers where native http/https modules are not available/polyfilled perfectly
      // @ts-expect-error
      fetch: globalThis.fetch,
      headers: {
        // Mimic native Windows WebDAV client
        'User-Agent': 'Microsoft-WebDAV-MiniRedir/10.0.19043',
        Accept: '*/*',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    };

    if (config.username) options.username = config.username;
    if (config.password) options.password = config.password;
    if (config.token) options.token = { access_token: config.token, token_type: 'Bearer' };

    this.client = createClient(config.url, options);
  }

  async readdir(path: string): Promise<FsStat[]> {
    try {
      const result = (await this.client.getDirectoryContents(path)) as FileStat[] | FileStat;
      const items: FileStat[] = Array.isArray(result) ? result : [result];

      return items.map((item) => ({
        filename: item.filename,
        basename: item.basename,
        lastmod: item.lastmod,
        size: item.size,
        type: item.type === 'directory' ? 'directory' : 'file',
        mime: item.mime,
        etag: item.etag,
      }));
    } catch (e) {
      console.error('WebDAV readdir error:', e);
      throw e;
    }
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    const result = await this.client.getFileContents(path, { format: 'binary' });
    return result as ArrayBuffer;
  }

  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    await this.client.putFileContents(path, content);
  }

  async unlink(path: string): Promise<void> {
    await this.client.deleteFile(path);
  }

  async stat(path: string): Promise<FsStat> {
    const item = (await this.client.stat(path)) as FileStat;
    return {
      filename: item.filename,
      basename: item.basename,
      lastmod: item.lastmod,
      size: item.size,
      type: item.type === 'directory' ? 'directory' : 'file',
      mime: item.mime,
      etag: item.etag,
    };
  }

  async ensureDir(path: string): Promise<void> {
    const parts = path.split('/').filter((p) => p);
    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      try {
        await this.client.stat(current);
      } catch {
        await this.client.createDirectory(current);
      }
    }
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

class S3FsClient implements FsClient {
  private client: S3Client;

  constructor(config: {
    bucket: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
  }) {
    this.client = new S3Client({
      endPoint: config.endpoint || '',
      region: config.region || 'auto',
      bucket: config.bucket,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
      pathStyle: false,
    });
  }

  async readdir(path: string): Promise<FsStat[]> {
    const prefix = normalizePath(path);
    const prefixWithSlash = prefix ? `${prefix}/` : '';
    const items: FsStat[] = [];

    const grouped = this.client.listObjectsGrouped({
      prefix: prefixWithSlash,
      delimiter: '/',
    });

    for await (const entry of grouped) {
      if (entry.type === 'CommonPrefix') {
        const dirPath = entry.prefix || '';
        const basename = dirPath.replace(/\/$/, '').split('/').pop() || '';
        items.push({
          filename: `/${dirPath}`,
          basename,
          lastmod: new Date().toISOString(),
          size: 0,
          type: 'directory',
        });
      } else if (entry.type === 'Object') {
        const key = entry.key || '';
        if (key === prefixWithSlash) continue;
        const basename = key.split('/').pop() || '';
        items.push({
          filename: `/${key}`,
          basename,
          lastmod: entry.lastModified?.toISOString() || new Date().toISOString(),
          size: entry.size || 0,
          type: 'file',
          etag: entry.etag?.replace(/"/g, ''),
        });
      }
    }

    return items;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    const key = normalizePath(path);
    const response = await this.client.getObject(key);
    if (!response.body) {
      throw new Error('Empty response body');
    }
    return await response.arrayBuffer();
  }

  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    const key = normalizePath(path);
    let body: string | Uint8Array;
    if (typeof content === 'string') {
      body = content;
    } else {
      body = new Uint8Array(content);
    }
    await this.client.putObject(key, body);
  }

  async unlink(path: string): Promise<void> {
    const key = normalizePath(path);
    await this.client.deleteObject(key);
  }

  async stat(path: string): Promise<FsStat> {
    const key = normalizePath(path);

    if (!key) {
      return {
        filename: '/',
        basename: '',
        lastmod: new Date().toISOString(),
        size: 0,
        type: 'directory',
      };
    }

    try {
      const info = await this.client.statObject(key);
      const basename = key.split('/').pop() || '';

      return {
        filename: `/${key}`,
        basename,
        lastmod: info.lastModified?.toISOString() || new Date().toISOString(),
        size: info.size || 0,
        type: 'file',
        etag: info.etag?.replace(/"/g, ''),
      };
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      if (err.statusCode === 404 || err.message?.includes('404')) {
        try {
          const list = this.client.listObjects({ prefix: `${key}/`, maxResults: 1 });
          const first = await list.next();
          if (!first.done && first.value) {
            const basename = key.split('/').pop() || '';
            return {
              filename: `/${key}`,
              basename,
              lastmod: new Date().toISOString(),
              size: 0,
              type: 'directory',
            };
          }
        } catch {
          // listObjects also failed, rethrow original error
        }
      }
      throw error;
    }
  }

  async ensureDir(_path: string): Promise<void> {
    // S3 无需创建目录
  }
}
