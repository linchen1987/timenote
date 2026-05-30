import { S3Client } from '@bradenmacdonald/s3-lite-client';
import type { FsStat, FsTransport } from './transport';

export function createS3Transport(config: {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}): FsTransport {
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
    async list(dirPath: string): Promise<FsStat[]> {
      const c = getClient();
      const prefix = dirPath ? `${dirPath}/` : '';
      const entries: FsStat[] = [];
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
          for await (const _item of c.listObjectsGrouped({ prefix, maxResults: 1 })) {
            return true;
          }
          return false;
        } catch {
          return false;
        }
      }
    },

    async ensureDir(_dirPath: string): Promise<void> {},

    isConfigured(): boolean {
      return true;
    },
  };
}
