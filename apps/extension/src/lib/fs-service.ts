import { createFsService } from '@timenote/core/fs';
import { extensionTransport } from './extension-transport';

export type StorageType = 'webdav' | 's3';

const setStorageType = async (type: StorageType): Promise<void> => {
  await chrome.storage.local.set({ '@timenote/storage_type': type });
};

export const FsService = {
  ...createFsService(extensionTransport),
  setStorageType,
};
