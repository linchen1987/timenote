import { createFsService } from '@timenote/core/fs';
import { type StorageType, setStorageType, webTransport } from './web-transport';

export const FsService = {
  ...createFsService(webTransport),
  setStorageType,
};
export type { StorageType };
