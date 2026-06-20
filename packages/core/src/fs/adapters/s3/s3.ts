import { S3Client } from '@bradenmacdonald/s3-lite-client';
import type { FsClientDriver } from '../../driver-registry';
import type { FsClient, FsClientConfig, FsClientStat, FsVolumeCredentialStore } from '../../types';

export type S3Volume = { scheme: 's3'; endpoint: string; bucket: string };

export type S3Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export type S3Endpoint = S3Volume & { rootPath: string };

export type S3VolumeCredential = S3Volume & S3Credentials;

export type S3ClientConfig = S3Volume & S3Credentials & { rootPath: string };

function createS3Client(config: S3ClientConfig): FsClient {
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

  const volumeUrl = `s3://${config.bucket}@${config.endpoint}`;
  const prefix =
    config.rootPath && config.rootPath !== '/' ? config.rootPath.replace(/\/+$/, '') : '';
  const resolve = (path: string) => {
    if (!prefix) return path;
    return path ? `${prefix}/${path}` : prefix;
  };

  const client: FsClient = {
    async list(dirPath: string): Promise<FsClientStat[]> {
      const c = getClient();
      const resolved = resolve(dirPath);
      const listPrefix = resolved ? `${resolved}/` : '';
      const entries: FsClientStat[] = [];
      try {
        for await (const item of c.listObjectsGrouped({
          prefix: listPrefix || '',
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
      } catch (e) {
        console.error('[S3 list]', dirPath, e);
        throw e;
      }
      return entries;
    },

    async read(filePath: string): Promise<string> {
      const c = getClient();
      const response = await c.getObject(resolve(filePath));
      return await response.text();
    },

    async write(filePath: string, content: string): Promise<void> {
      const c = getClient();
      await c.putObject(resolve(filePath), content);
    },

    async readBinary(filePath: string): Promise<ArrayBuffer> {
      const c = getClient();
      const response = await c.getObject(resolve(filePath));
      return await response.arrayBuffer();
    },

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
      const c = getClient();
      await c.putObject(resolve(filePath), new Uint8Array(data));
    },

    async remove(filePath: string): Promise<void> {
      const c = getClient();
      await c.deleteObject(resolve(filePath));
    },

    async exists(filePath: string): Promise<boolean> {
      const c = getClient();
      const resolved = resolve(filePath);
      try {
        await c.statObject(resolved);
        return true;
      } catch {
        try {
          const s3prefix = resolved.endsWith('/') ? resolved : `${resolved}/`;
          for await (const _item of c.listObjectsGrouped({
            prefix: s3prefix,
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

    scheme: 's3',
    volumeUrl,
    url: prefix ? `${volumeUrl}/${prefix}` : volumeUrl,
    rootPath: prefix || '/',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    },
    testConnection: async () => {
      try {
        const c = getClient();
        for await (const _item of c.listObjects({ prefix: '', maxResults: 1 })) {
          break;
        }
        return true;
      } catch (e) {
        const err = e as { statusCode?: number };
        console.error('[S3 testConnection]', e);
        if (err.statusCode === 403) {
          throw new Error('Access denied — check access key / secret key');
        }
        if (err.statusCode === 404) {
          throw new Error('Bucket not found — check bucket name / endpoint');
        }
        throw e;
      }
    },
  };
  return client;
}

export function computeS3VolumeUrl({
  bucket,
  endpoint,
}: {
  bucket: string;
  endpoint: string;
}): string {
  return `s3://${bucket}@${endpoint}`;
}

export function parseS3Url(url: string): S3Endpoint {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0 || url.slice(0, protoIdx) !== 's3') {
    throw new Error(`Invalid s3 URL: ${url}`);
  }
  const rest = url.slice(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');
  let bucket: string;
  let endpoint: string;
  let rootPath: string;
  if (lastAt < 0) {
    const slashIdx = rest.indexOf('/');
    endpoint = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
    rootPath = slashIdx < 0 ? '/' : rest.slice(slashIdx + 1);
    bucket = '';
  } else {
    bucket = rest.slice(0, lastAt);
    const afterAt = rest.slice(lastAt + 1);
    const slashIdx = afterAt.indexOf('/');
    endpoint = slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx);
    rootPath = slashIdx < 0 ? '/' : afterAt.slice(slashIdx + 1);
  }
  return { scheme: 's3', bucket, endpoint, rootPath };
}

export function resolveS3ConfigFromUrl(
  url: string,
  store?: FsVolumeCredentialStore,
): S3ClientConfig {
  const endpoint = parseS3Url(url);
  const volumeUrl = computeS3VolumeUrl(endpoint);
  if (!store) throw new Error(`Store required to resolve config from URL for scheme 's3'`);
  const stored = store.getVolumeCredential(volumeUrl);
  if (!stored || stored.scheme !== 's3') throw new Error(`S3 volume not configured: ${volumeUrl}`);
  return { ...stored, rootPath: endpoint.rootPath } as S3ClientConfig;
}

export const S3Driver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    return createS3Client(config as S3ClientConfig);
  },
};

export { createS3Client };
