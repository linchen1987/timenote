import { createFsService } from '@timenote/core/fs';
import { extensionTransport } from './extension-transport';

export const FsService = createFsService(extensionTransport);

export type StorageType = 'webdav' | 's3';

export const setStorageType = async (type: StorageType): Promise<void> => {
  await chrome.storage.local.set({ '@timenote/storage_type': type });
};
