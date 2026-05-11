import type { ProviderConfig } from '@timenote/core';
import type { FsConnection } from './services/fs-client';

export function connectionFromProvider(provider: ProviderConfig): FsConnection {
  if (provider.type === 'webdav' && provider.webdav) {
    return {
      type: 'webdav',
      url: provider.webdav.url,
      username: provider.webdav.username,
      password: provider.webdav.password,
    };
  }
  if (provider.type === 's3' && provider.s3) {
    return {
      type: 's3',
      bucket: provider.s3.bucket,
      endpoint: provider.s3.endpoint,
      accessKeyId: provider.s3.accessKeyId,
      secretAccessKey: provider.s3.secretAccessKey,
      region: provider.s3.region,
    };
  }
  throw new Error(`Invalid provider: ${provider.id}`);
}

async function callApiWithConnection<T = unknown>(
  connection: FsConnection,
  method: string,
  path: string,
  args?: unknown,
): Promise<T> {
  const res = await fetch('/api/fs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection, method, path, args }),
  });

  const data = (await res.json()) as { error?: string; result?: T };
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
  return data.result as T;
}

export function createTransportForProvider(provider: ProviderConfig) {
  const connection = connectionFromProvider(provider);

  return {
    async list(path: string) {
      const result = await callApiWithConnection(connection, 'list', path);
      return Array.isArray(result) ? result : [result];
    },

    async read(path: string): Promise<string> {
      return callApiWithConnection<string>(connection, 'read', path);
    },

    async write(path: string, content: string) {
      await callApiWithConnection(connection, 'write', path, { content });
    },

    async exists(path: string): Promise<boolean> {
      try {
        await callApiWithConnection(connection, 'stat', path);
        return true;
      } catch {
        return false;
      }
    },

    async ensureDir(path: string) {
      await callApiWithConnection(connection, 'ensureDir', path);
    },

    async remove(path: string) {
      await callApiWithConnection(connection, 'delete', path);
    },

    isConfigured(): boolean {
      return true;
    },
  };
}
