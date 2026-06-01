import { S3Client } from '@bradenmacdonald/s3-lite-client';
import type { FsClient, FsClientStat } from '../../client';
import { scopeToPath } from '../../client';
import type { FsProviderEntry, FsProviderStore, FsProvider } from '../provider';

export type S3Identity = { type: 's3'; endpoint: string; bucket: string };

export type S3Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export type S3Endpoint = S3Identity & { path: string };

export type S3Account = S3Identity & S3Credentials;

export type S3Config = S3Identity & S3Credentials & { path: string };

function createS3Client(config: S3Config): FsClient {
  let clientCache: S3Client | null = null;

  function getClient() {
    if (clientCache) return clientCache;
    if (!config.endpoint) throw new Error('S3 endpoint is required');
    clientCache = new S3Client({
      endPoint: config.endpoint,
      bucket: config.bucket,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
      region: config.region || 'auto',
      useSSL: true,
      pathStyle: false,
    });
    return clientCache;
  }

  return {
    async list(dirPath: string): Promise<FsClientStat[]> {
      const c = getClient();
      const prefix = dirPath ? `${dirPath}/` : '';
      const entries: FsClientStat[] = [];
      try {
        for await (const item of c.listObjectsGrouped({
          prefix: prefix || '',
          delimiter: '/',
        })) {
          if (item.type === 'Object') {
            const key: string = item.key || '';
            const name = key.replace(/\/$/, '').split('/').pop() || '';
            entries.push({
              filename: key.replace(/\/$/, ''),
              basename: name,
              lastmod: item.lastModified?.toISOString?.() || new Date().toISOString(),
              size: item.size || 0,
              type: 'file' as const,
            });
          } else if (item.type === 'CommonPrefix') {
            const name = (item.prefix || '').replace(/\/$/, '').split('/').pop() || '';
            entries.push({
              filename: (item.prefix || '').replace(/\/$/, ''),
              basename: name,
              lastmod: new Date().toISOString(),
              size: 0,
              type: 'directory' as const,
            });
          }
        }
      } catch {}
      return entries;
    },

    async read(filePath: string): Promise<string> {
      const c = getClient();
      const response = await c.getObject(filePath);
      return await response.text();
    },

    async write(filePath: string, content: string): Promise<void> {
      const c = getClient();
      await c.putObject(filePath, content);
    },

    async readBinary(filePath: string): Promise<ArrayBuffer> {
      const c = getClient();
      const response = await c.getObject(filePath);
      return await response.arrayBuffer();
    },

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
      const c = getClient();
      await c.putObject(filePath, new Uint8Array(data));
    },

    async remove(filePath: string): Promise<void> {
      const c = getClient();
      await c.deleteObject(filePath);
    },

    async exists(filePath: string): Promise<boolean> {
      const c = getClient();
      try {
        await c.statObject(filePath);
        return true;
      } catch {
        try {
          const prefix = filePath.endsWith('/') ? filePath : filePath + '/';
          for await (const _item of c.listObjectsGrouped({
            prefix,
            delimiter: '/' as any,
            maxResults: 1,
          })) {
            return true;
          }
          return false;
        } catch {
          return false;
        }
      }
    },

    async ensureDir(_dirPath: string): Promise<void> {},
  };
}

export const s3Provider: FsProvider<S3Identity> = {
  scheme: 's3',

  getProviderId({ bucket, endpoint }: S3Identity): string {
    return `s3://${bucket}@${endpoint}`;
  },

  parseUrl(url: string): S3Endpoint {
    const protoIdx = url.indexOf('://');
    if (protoIdx < 0 || url.slice(0, protoIdx) !== 's3') {
      throw new Error(`Invalid s3 URL: ${url}`);
    }
    const rest = url.slice(protoIdx + 3);
    const lastAt = rest.lastIndexOf('@');
    let bucket: string;
    let endpoint: string;
    let path: string;
    if (lastAt < 0) {
      const slashIdx = rest.indexOf('/');
      endpoint = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
      path = slashIdx < 0 ? '/' : rest.slice(slashIdx + 1);
      bucket = '';
    } else {
      bucket = rest.slice(0, lastAt);
      const afterAt = rest.slice(lastAt + 1);
      const slashIdx = afterAt.indexOf('/');
      endpoint = slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx);
      path = slashIdx < 0 ? '/' : afterAt.slice(slashIdx + 1);
    }
    return { type: 's3', bucket, endpoint, path };
  },

  buildUrl(endpoint: S3Endpoint): string {
    const id = this.getProviderId(endpoint);
    return endpoint.path && endpoint.path !== '/' ? `${id}/${endpoint.path}` : id;
  },

  create(config: S3Config): FsClient {
    const client = createS3Client(config);
    if (config.path && config.path !== '/') return scopeToPath(config.path, client);
    return client;
  },

  async testConnection(config: S3Config): Promise<boolean> {
    try {
      const client = this.create(config);
      return await client.exists('/');
    } catch {
      return false;
    }
  },

  toEntry(account: S3Account): FsProviderEntry {
    return { ...account, id: this.getProviderId(account) };
  },

  resolveConfigFromUrl(url: string, store: FsProviderStore): S3Config {
    const endpoint = this.parseUrl(url);
    const id = this.getProviderId(endpoint);
    const stored = store.getProvider(id);
    if (!stored || stored.type !== 's3') throw new Error(`S3 provider not configured: ${id}`);
    return { ...stored, path: endpoint.path } as S3Config;
  },

  createFromUrl(url: string, store: FsProviderStore): FsClient {
    return this.create(this.resolveConfigFromUrl(url, store));
  },
};

export { createS3Client };
