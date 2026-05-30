import { createTransportFromConfig, type ProviderConfig } from '@timenote/core';
import type { FsMessage, MessageResponse } from '../lib/message-types';

export type { ProviderConfig as FsConfig };

chrome.runtime.onMessage.addListener((message: FsMessage, _sender, sendResponse) => {
  if (message.type?.startsWith('fs:')) {
    handleFsMessage(message).then(sendResponse);
    return true;
  }
});

function getConfig(message: FsMessage): ProviderConfig | null {
  if ('config' in message) {
    return (message as { config: ProviderConfig }).config;
  }
  return null;
}

async function handleFsMessage(message: FsMessage): Promise<MessageResponse> {
  try {
    const config = getConfig(message);
    if (!config) {
      return { success: false, error: 'Storage not configured' };
    }

    const transport = createTransportFromConfig(config);

    switch (message.type) {
      case 'fs:list': {
        const result = await transport.list(message.path);
        return { success: true, data: result };
      }
      case 'fs:read': {
        const content = await transport.read(message.path);
        return { success: true, data: content };
      }
      case 'fs:write': {
        await transport.write(message.path, message.content);
        return { success: true, data: null };
      }
      case 'fs:readBinary': {
        const buffer = await transport.readBinary(message.path);
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return { success: true, data: btoa(binary) };
      }
      case 'fs:writeBinary': {
        const binary = atob(message.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        await transport.writeBinary(message.path, bytes.buffer);
        return { success: true, data: null };
      }
      case 'fs:exists': {
        const result = await transport.exists(message.path);
        return { success: true, data: result };
      }
      case 'fs:ensureDir': {
        await transport.ensureDir(message.path);
        return { success: true, data: null };
      }
      case 'fs:delete': {
        await transport.remove(message.path);
        return { success: true, data: null };
      }
      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
