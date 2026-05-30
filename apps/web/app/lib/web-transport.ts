import type { FsStat, FsTransport, ProviderConfig } from '@timenote/core';
import { connectionFromProvider, type FsConnection } from '@timenote/core';

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

export function createTransportForProvider(provider: ProviderConfig): FsTransport {
  const connection = connectionFromProvider(provider);

  return {
    async list(path: string) {
      const result = await callApiWithConnection<FsStat[]>(connection, 'list', path);
      return Array.isArray(result) ? result : [result];
    },

    async read(path: string): Promise<string> {
      return callApiWithConnection<string>(connection, 'read', path);
    },

    async write(path: string, content: string) {
      await callApiWithConnection(connection, 'write', path, { content });
    },

    async readBinary(path: string): Promise<ArrayBuffer> {
      const res = await fetch('/api/fs/binary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection, path }),
      });
      if (!res.ok) throw new Error('Binary read failed');
      return await res.arrayBuffer();
    },

    async writeBinary(path: string, data: ArrayBuffer) {
      const res = await fetch('/api/fs/binary', {
        method: 'POST',
        body: (() => {
          const fd = new FormData();
          fd.append('meta', JSON.stringify({ connection, path }));
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
        await callApiWithConnection(connection, 'exists', path);
        return true;
      } catch {
        return false;
      }
    },

    async ensureDir(path: string) {
      await callApiWithConnection(connection, 'ensureDir', path);
    },

    async remove(path: string) {
      await callApiWithConnection(connection, 'remove', path);
    },

    isConfigured(): boolean {
      return true;
    },
  };
}
