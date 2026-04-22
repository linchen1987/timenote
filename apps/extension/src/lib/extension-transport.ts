import type { FsStat, FsTransport } from '@timenote/core/fs';
import type { FsMessage, MessageResponse } from './message-types';

async function sendMessage<T>(message: FsMessage): Promise<T> {
  const response: MessageResponse<T> = await chrome.runtime.sendMessage(message);
  if (!response.success) {
    throw new Error(response.error || 'Message failed');
  }
  return response.data as T;
}

export const extensionTransport: FsTransport = {
  async list(path: string): Promise<FsStat[]> {
    return sendMessage<FsStat[]>({ type: 'fs:list', path });
  },

  async read(path: string): Promise<string> {
    return sendMessage<string>({ type: 'fs:read', path });
  },

  async write(path: string, content: string): Promise<void> {
    await sendMessage<null>({ type: 'fs:write', path, content });
  },

  async exists(path: string): Promise<boolean> {
    return sendMessage<boolean>({ type: 'fs:exists', path });
  },

  async ensureDir(path: string): Promise<void> {
    await sendMessage<null>({ type: 'fs:ensureDir', path });
  },

  async isConfigured(): Promise<boolean> {
    const result = await chrome.storage.local.get([
      '@timenote/storage_type',
      '@timenote/webdav_url',
      '@timenote/s3_bucket',
    ]);
    return !!(
      result['@timenote/storage_type'] &&
      (result['@timenote/webdav_url'] || result['@timenote/s3_bucket'])
    );
  },
};
