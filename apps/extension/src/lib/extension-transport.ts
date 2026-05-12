import type { ProviderConfig, RemoteTransport } from '@timenote/core';
import type { FsStat } from '@timenote/core/fs';
import type { FsConnection, FsMessage, MessageResponse } from './message-types';

function connectionFromProvider(provider: ProviderConfig): FsConnection {
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

async function sendMessage<T>(message: FsMessage): Promise<T> {
  const response: MessageResponse<T> = await chrome.runtime.sendMessage(message);
  if (!response.success) {
    throw new Error(response.error || 'Message failed');
  }
  return response.data as T;
}

export function createExtensionTransport(provider: ProviderConfig): RemoteTransport {
  const connection = connectionFromProvider(provider);

  return {
    async list(path: string): Promise<FsStat[]> {
      return sendMessage<FsStat[]>({ type: 'fs:list', path, connection });
    },

    async read(path: string): Promise<string> {
      return sendMessage<string>({ type: 'fs:read', path, connection });
    },

    async write(path: string, content: string): Promise<void> {
      await sendMessage<null>({ type: 'fs:write', path, content, connection });
    },

    async readBinary(path: string): Promise<ArrayBuffer> {
      const base64: string = await sendMessage<string>({ type: 'fs:readBinary', path, connection });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    },

    async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      await sendMessage<null>({ type: 'fs:writeBinary', path, content: btoa(binary), connection });
    },

    async remove(path: string): Promise<void> {
      await sendMessage<null>({ type: 'fs:delete', path, connection });
    },

    async exists(path: string): Promise<boolean> {
      return sendMessage<boolean>({ type: 'fs:exists', path, connection });
    },

    async ensureDir(path: string): Promise<void> {
      await sendMessage<null>({ type: 'fs:ensureDir', path, connection });
    },

    isConfigured(): boolean {
      return true;
    },
  };
}
